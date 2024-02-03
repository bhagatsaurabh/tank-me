import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as Colyseus from 'colyseus.js';

import { useAuthStore } from './auth';
import type { Null, LobbyStatus } from '@/interfaces/types';
import type { RoomState } from '@/game/state';
import { GameClient } from '@/game/client';

export const useLobbyStore = defineStore('lobby', () => {
  const auth = useAuthStore();
  const status = ref<LobbyStatus>('connecting');
  // Because of weird typescript bug...

  const client = ref<GameClient | undefined>(undefined);
  const lobbyRoom = ref<Null<Colyseus.Room>>(null);
  const allRooms = ref<Colyseus.RoomAvailable[]>([]);
  const gameRoom = ref<Null<Colyseus.Room<RoomState>>>(null);

  async function connect() {
    client.value = GameClient.connect();
    if (!client.value) return;

    try {
      lobbyRoom.value = await client.value.joinRoom('lobby', (auth.user as any).accessToken);
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
  async function match(map: 'desert') {
    if (!client.value) return false;

    status.value = 'matchmaking';
    try {
      gameRoom.value = await client.value.joinRoom(map, (auth.user as any).accessToken);

      gameRoom.value.state.listen('status', (newVal) => {
        console.log(newVal, gameRoom.value?.state.status);
        if (newVal === 'ready') status.value = 'playing';
      });

      return true;
    } catch (error) {
      console.log(error);
    }
    status.value = 'idle';
    return false;
  }

  return {
    status,
    connect,
    match
  };
});
