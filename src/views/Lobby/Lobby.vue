<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useLobbyStore } from '@/stores/lobby';
import { useLoaderStore } from '@/stores/loader';
import Header from '@/components/Common/Header/Header.vue';
import Button from '@/components/Common/Button/Button.vue';
import Spinner from '@/components/Common/Spinner/Spinner.vue';
import Backdrop from '@/components/Common/Backdrop/Backdrop.vue';
import InputText from '@/components/Common/InputText/InputText.vue';
import { AssetLoader } from '@/game/loader';
import { GameClient } from '@/game/client';
import { noop } from '@/utils/utils';
import type { Nullable } from '@babylonjs/core';
import type { AuthStatus } from '@/types/types';
import Modal from '@/components/Modal/Modal.vue';

const auth = useAuthStore();
const lobby = useLobbyStore();
const loader = useLoaderStore();
const router = useRouter();

const email = ref<string>('');
const startTS = ref(-1);
const timer = ref('');
const showProfile = ref(false);
const emailEl = ref<Nullable<InstanceType<typeof InputText>>>(null);
const isGuestUpgrading = ref<boolean>(false);
const suggestAI = ref(false);
const isSuggestionRejected = ref<Nullable<boolean>>(false);

const validateEmail = (val: string) => {
  if (!val) return 'Please enter an e-mail';
  // eslint-disable-next-line no-useless-escape
  if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(val)) return null;
  return 'Not a valid e-mail';
};
let oldStatus: AuthStatus;
const handleUpgrade = async () => {
  if (emailEl.value?.validate(email.value)) {
    return;
  }

  let oStatus = auth.status;
  if (await auth.signIn('email', email.value, '', true)) {
    isGuestUpgrading.value = true;
    oldStatus = oStatus;
  }
};
let handle = -1;
const handleStart = async () => {
  if (lobby.status === 'idle') {
    clearInterval(handle);
    startTS.value = Date.now();
    timer.value = '00:00';
    handle = setInterval(() => {
      const mark = new Date(Date.now() - startTS.value);
      if (mark.getTime() / 1000 > 10 && !isSuggestionRejected.value) {
        suggestAI.value = true;
      }
      timer.value = `${mark.toISOString().substring(14, 19)}`;
    }, 1000);
    await lobby.match('desert');
  } else {
    handleReset(true);
  }
};
const handleStartAI = () => {
  handleReset(true);
  router.push({ path: '/game', hash: '#ai' });
};
const handleReset = (disconnect = false) => {
  disconnect && GameClient.disconnect();
  startTS.value = -1;
  clearInterval(handle);
  isSuggestionRejected.value = false;
};
const handleSignOut = async () => {
  if (await auth.signOut()) {
    showProfile.value = false;
    router.push('/');
  }
};
const handleUpgradeRetry = () => {
  isGuestUpgrading.value = false;
  auth.status = oldStatus;
};
const handleAction = (action: { text: string }) => {
  if (action.text === 'Yes') {
    handleStartAI();
  } else {
    isSuggestionRejected.value = true;
  }

  suggestAI.value = false;
};

watch(
  () => lobby.status,
  () => {
    if (lobby.status === 'playing') {
      handleReset();
      router.push({ path: '/game' });
    }
  }
);

onMounted(async () => {
  await AssetLoader.load();
  await lobby.connect();
});
</script>

<template>
  <Header>
    <template #left>
      <div class="header-hero">
        <img class="hero" alt="tankme logo" src="/assets/images/logo192.png" />
        <span class="ml-1">Tank Me</span>
      </div>
    </template>
    <template #right>
      <div class="header-controls">
        <Button>Leaderboard</Button>
        <Button class="profile-control" :class="{ float: showProfile }" @click="showProfile = !showProfile">
          <img alt="avatar icon" src="/assets/icons/avatar.png" />
        </Button>
        <Button v-if="showProfile" class="profile-control filler">
          <img alt="avatar icon" src="/assets/icons/avatar.png" />
        </Button>
        <Transition name="fade-down">
          <Backdrop v-if="showProfile" :show="showProfile" @dismiss="showProfile = !showProfile" clear>
            <aside @pointerup.stop="noop" class="profile">
              <section class="info">
                <span class="name">{{ auth.profile?.username }}</span>
              </section>
              <section class="status">{{ !auth.profile?.email ? 'Not verified' : 'Verified' }}</section>
              <section v-if="!auth.profile?.email && !isGuestUpgrading" class="verify">
                <InputText
                  class="mt-1 mb-2p5"
                  ref="emailEl"
                  v-model="email"
                  type="email"
                  placeholder="E-mail"
                  :attrs="{ spellCheck: false }"
                  :validator="(val: string) => validateEmail(val)"
                />
                <Button :action="handleUpgrade" :size="0.75" async>Verify</Button>
              </section>
              <section v-if="isGuestUpgrading" class="guest-upgrade">
                <h5>
                  Verification link sent to <span class="upgrade-email">{{ email }}</span>
                </h5>
                <Button :action="handleUpgradeRetry" :size="0.75">Change E-mail</Button>
              </section>
              <section class="controls">
                <Button icon="sign-out" :action="handleSignOut" :size="0.75" icon-left async>
                  Signout
                </Button>
              </section>
            </aside>
          </Backdrop>
        </Transition>
      </div>
    </template>
  </Header>
  <Backdrop :show="(auth.status === 'pending' || loader.isLoading) && !isGuestUpgrading" :dismissable="false">
    <div class="wait">
      <Spinner :progress="loader.progress" trackable>
        <span>{{ `${Math.round(loader.progress * 100)}%` }}</span>
      </Spinner>
    </div>
  </Backdrop>
  <main class="lobby">
    <Modal
      v-if="suggestAI"
      title="Play vs. AI ?"
      :controls="[{ text: 'Yes' }, { text: 'No' }]"
      @dismiss="() => handleAction({ text: 'No' })"
      @action="handleAction"
    >
      Match-making is slow and taking longer than expected.
    </Modal>
    <div class="match">
      <Button class="match-control" @click="handleStart">
        <template v-if="lobby.status === 'idle'">
          <span>Start</span>
        </template>
        <template v-else>
          <div>Cancel</div>
          <div class="fs-0p75">{{ timer }}</div>
        </template>
      </Button>
      <Button @click="handleStartAI" :size="0.75" :disabled="lobby.status === 'matchmaking'">vs. AI </Button>
    </div>
  </main>
</template>

<style scoped>
.hero {
  max-height: 80%;
}
.header-hero {
  padding: 0 1rem;
  display: flex;
  align-items: center;
  height: 100%;
}
.header-hero img {
  filter: drop-shadow(0px 0px 10px #000);
}
.header-hero span {
  color: #000;
  text-shadow: 0px 0px 10px #656565;
}
.header-controls {
  display: flex;
}

.wait {
  position: fixed;
  width: 10rem;
  height: 2.1rem;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.lobby {
  width: 100vw;
  height: calc(100vh - var(--header-height));
}
.lobby .match {
  position: absolute;
  bottom: 0;
  left: 0;
  padding: 1rem;
  display: flex;
  align-items: flex-end;
  column-gap: 1.5rem;
}
.match-control {
  padding: 1rem 2rem;
  font-size: 1.5rem !important;
}
.match-control:deep(.content) {
  flex-direction: column !important;
}

.profile {
  max-width: 20rem;
  min-width: 15rem;
  position: fixed;
  right: 0;
  top: var(--header-height);
  z-index: 100;
  box-shadow: 0px 0px 10px 0px #000;
  background-color: #c9b18b;
  background-image: url(/assets/images/dirt-overlay.png);
  background-size: 50%;
  background-position: bottom;
  padding: 1rem;
}
.profile .info {
  display: flex;
}
.profile .info .name {
  color: #000;
}

.profile-control.float {
  position: fixed;
  right: 0;
  top: 0;
  z-index: 101;
  box-shadow: 0px -10px 10px 0px;
}
.profile-control.float:active {
  box-shadow:
    0px -10px 10px 0px,
    2.5px 2.5px 5px 0 black inset !important;
}
.profile .status {
  color: #585858;
  font-size: 0.75rem;
}
.profile .controls {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.guest-upgrade h5 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: #303030;
}
.upgrade-email {
  color: #ffffff;
  background-color: #00000066;
  padding: 0.1rem 0.5rem;
}
</style>
