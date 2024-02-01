import { ref, type Ref, type UnwrapRef } from 'vue';
import { defineStore } from 'pinia';
import * as Colyseus from 'colyseus.js';

import { useAuthStore } from './auth';
import type { Null, LobbyStatus } from '@/interfaces/types';
import type { RoomState } from '@/game/state';
import { Color3, CreateSphere, Mesh, StandardMaterial, Vector3 } from '@babylonjs/core';

export const useLobbyStore = defineStore('lobby', () => {
  const auth = useAuthStore();
  const status = ref<LobbyStatus>('connecting');
  // Because of weird typescript bug...
  const client: Ref<UnwrapRef<Null<Colyseus.Client>>> = ref<Null<Colyseus.Client>>(null);
  const lobbyRoom = ref<Null<Colyseus.Room>>(null);
  const allRooms = ref<Colyseus.RoomAvailable[]>([]);
  const gameRoom: Ref<UnwrapRef<Null<Colyseus.Room<RoomState>>>> = ref<Null<Colyseus.Room<RoomState>>>(null);
  const playerEntities = ref<Record<string, Mesh>>({});
  const playerNextPosition = ref<Record<string, Vector3>>({});

  async function connect() {
    client.value = new Colyseus.Client(import.meta.env.VITE_TANKME_SERVER);
    try {
      lobbyRoom.value = await client.value.joinOrCreate('lobby', {
        accessToken: (auth.user as any).accessToken
      });

      lobbyRoom.value.onMessage('rooms', (rooms) => (allRooms.value = rooms));
      lobbyRoom.value.onMessage('+', ([roomId, room]) => {
        const roomIndex = allRooms.value.findIndex((room) => room.roomId === roomId);
        if (roomIndex !== -1) {
          allRooms.value[roomIndex] = room;
        } else {
          allRooms.value.push(room);
        }
      });
      lobbyRoom.value.onMessage(
        '-',
        (roomId) => (allRooms.value = allRooms.value.filter((room) => room.roomId !== roomId))
      );

      status.value = 'idle';
      return true;
    } catch (error) {
      console.log(error);
    }
    status.value = 'failed';
    return false;
  }
  async function match(map: string) {
    if (!client.value) return false;

    status.value = 'matchmaking';
    try {
      gameRoom.value = await client.value.joinOrCreate<RoomState>(map, {
        accessToken: (auth.user as any).accessToken
      });

      console.log(gameRoom.value.sessionId, 'joined', gameRoom.value.name);

      gameRoom.value.state.players.onAdd((player, sessionId) => {
        const isCurrentPlayer = sessionId === gameRoom.value?.sessionId;
        const sphere = CreateSphere(`player-${sessionId}`, {
          segments: 8,
          diameter: 40
        });
        sphere.position.set(player.x, player.y, player.z);
        sphere.material = new StandardMaterial(`player-material-${sessionId}`);
        (sphere.material as StandardMaterial).emissiveColor = isCurrentPlayer
          ? Color3.FromHexString('#ff9900')
          : Color3.Gray();
        playerEntities.value[sessionId] = sphere;
        playerNextPosition.value[sessionId] = sphere.position.clone();
        player.onChange(() => {
          playerNextPosition.value[sessionId].set(player.x, player.y, player.z);
        });
      });
      gameRoom.value.state.players.onRemove((player, sessionId) => {
        playerEntities.value[sessionId].dispose();
        delete playerEntities.value[sessionId];
      });

      status.value = 'playing';
      return true;
    } catch (error) {
      console.log(error);
    }
    status.value = 'idle';
    return false;
  }

  return {
    status,
    client,
    gameRoom,
    playerEntities,
    playerNextPosition,
    connect,
    match
  };
});
