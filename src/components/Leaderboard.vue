<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Nullable } from '@babylonjs/core';

import { trapBetween, trapFocus } from '@/utils';
import { useRemoteDBStore } from '@/stores';
import type { ITrapBounds } from '@/types';
import { Button, Spinner, Icon } from '@/components/common';

const emit = defineEmits(['dismiss']);

const remoteDB = useRemoteDBStore();
const router = useRouter();

const isBusy = ref(false);
const show = ref(false);
const el = ref<Nullable<HTMLElement>>(null);
const bound = ref<Nullable<ITrapBounds>>(null);

const keyListener = (event: KeyboardEvent) => trapFocus(event, el.value!, bound.value!);
const handleDismiss = () => {
  if (show.value) {
    window.removeEventListener('keydown', keyListener);
    show.value = false;
    router.back();
  }
};
const handleLeave = () => {
  emit('dismiss');
};
const getMedalIcon = (pos: number) => {
  if (pos === 0) return 'gold-medal';
  else if (pos === 1) return 'silver-medal';
  else return 'bronze-medal';
};

let unregisterGuard = () => {};
watch(
  show,
  async (newVal, oldVal) => {
    if (oldVal !== newVal && newVal) {
      await router.push({ hash: '#leaderboard' });

      unregisterGuard = router.beforeEach((_to, from, next) => {
        if (from.hash === '#leaderboard') {
          window.removeEventListener('keydown', keyListener);
          show.value = false;
        }
        unregisterGuard();
        next();
      });
    }
  },
  { immediate: true }
);
watch(el, () => {
  if (el.value) {
    bound.value = trapBetween(el.value);
    window.addEventListener('keydown', keyListener);
  }
});

onMounted(async () => {
  (document.activeElement as HTMLElement)?.blur();
  show.value = true;

  isBusy.value = true;
  await remoteDB.fetchLeaderboard();
  isBusy.value = false;
});
onBeforeUnmount(unregisterGuard);
</script>

<template>
  <Transition @after-leave="handleLeave" name="fade" appear>
    <aside v-if="show" class="leaderboard" ref="el" role="dialog">
      <section class="title">
        <div class="bg"></div>
        <h1>Leaderboard</h1>
        <Button @click="handleDismiss" icon="chevron-left" icon-left :size="0.75">Back</Button>
      </section>
      <section class="content">
        <div v-if="isBusy" class="wait">
          <Spinner />
        </div>
        <table v-else>
          <tr>
            <th>&nbsp;</th>
            <th>Player</th>
            <th>Points</th>
            <th>Matches</th>
            <th>Wins</th>
          </tr>
          <tr v-for="(profile, idx) in remoteDB.leaderboard" :key="profile.id">
            <td class="medal-cell"><Icon v-if="idx < 3" alt="medal-icon" :name="getMedalIcon(idx)" /></td>
            <td>{{ profile.username }}</td>
            <td>{{ profile.stats?.points }}</td>
            <td>{{ profile.stats?.matches }}</td>
            <td>{{ profile.stats?.wins }}</td>
          </tr>
        </table>
      </section>
    </aside>
  </Transition>
</template>

<style scoped>
.leaderboard {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 50;
  background-color: #c9b18b8c;
  backdrop-filter: blur(5px);
}

.leaderboard .title {
  color: #000;
  margin: 2rem;
  font-size: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  display: flex;
}
.leaderboard .title h1 {
  color: #fedeab;
  margin-left: 2rem;
}
.leaderboard .title .bg {
  position: absolute;
  width: 50%;
  height: 100%;
  top: 0;
  left: 0;
  background: url(/assets/images/background.jpg);
  mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0));
}

.leaderboard .content {
  margin-left: 2rem;
  margin-right: 2rem;
  overflow-y: auto;
  margin-bottom: 2rem;
  max-height: calc(100% - 9.75rem);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 1) 75%, rgba(0, 0, 0, 0));
}
.leaderboard .content .wait {
  width: 100%;
  display: flex;
  justify-content: center;
}
.leaderboard .content .wait:deep(.spinner) {
  width: 15rem;
  height: 2.2rem;
}
.leaderboard .content table {
  color: #000;
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 4rem;
}
.content table tr {
  border-bottom: 1px solid #5c5c5c73;
}
.content table tr:first-child {
  position: sticky;
  top: 0;
  color: #ffffffba;
  background-color: #cead7a;
  z-index: 5;
  box-shadow: 0 0 10px 0px #000;
}
.content table th {
  text-align: left;
  padding: 0.5rem;
}
.content table td {
  padding: 0.5rem;
}
.medal-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

@media (max-width: 768px) {
  .leaderboard .title {
    flex-direction: column;
    align-items: flex-start;
  }

  .leaderboard .title button {
    margin-left: 2rem;
    margin-bottom: 1rem;
  }
}
</style>
