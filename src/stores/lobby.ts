import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as Colyseus from 'colyseus.js';
import type { Nullable } from '@babylonjs/core';

import { useAuthStore } from './auth';
import type { LobbyStatus } from '@/types';
import type { RoomState } from '@/game/state';
import { GameClient } from '@/game/client';
import { useNotificationStore } from './notification';
import { Notifications } from '@/utils/constants';

export const useLobbyStore = defineStore('lobby', () => {
  const auth = useAuthStore();

  const status = ref<LobbyStatus>('connecting');
  const client = ref<GameClient | undefined>(undefined);
  const lobbyRoom = ref<Nullable<Colyseus.Room>>(null);
  const gameRoom = ref<Nullable<Colyseus.Room<RoomState>>>(null);
  const allRooms = ref<Colyseus.RoomAvailable[]>([]);

  async function connect() {
    const notify = useNotificationStore();
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
      notify.push(Notifications.ROOM_JOIN_FAILED({ error }));
    }
    status.value = 'failed';
    return false;
  }
  async function match(map: 'desert') {
    if (!client.value) return false;

    const notify = useNotificationStore();
    status.value = 'matchmaking';
    try {
      gameRoom.value = await client.value.joinRoom(map, (auth.user as any).accessToken);
      return true;
    } catch (error) {
      notify.push(Notifications.ROOM_JOIN_FAILED({ error }));
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
