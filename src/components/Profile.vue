<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Nullable } from '@babylonjs/core';

import { noop } from '@/utils';
import { useAuthStore } from '@/stores';
import type { AuthStatus } from '@/types';
import { Backdrop, InputText, Button } from '@/components/common';

defineProps({
  isGuestUpgrading: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['dismiss', 'guest-upgrade']);

const auth = useAuthStore();
const router = useRouter();

const show = ref(false);
const email = ref<string>('');
const emailEl = ref<Nullable<InstanceType<typeof InputText>>>(null);
const isVerified = computed(() => !!auth.profile?.email);

const validateEmail = (val: string) => {
  if (!val) return 'Please enter an e-mail';
  // eslint-disable-next-line no-useless-escape
  if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(val)) return '';
  return 'Not a valid e-mail';
};
let oldStatus: AuthStatus;
const handleUpgrade = async () => {
  if (emailEl.value?.validate(email.value)) {
    return;
  }

  let oStatus = auth.status;
  if (await auth.signIn('email', email.value, '', true)) {
    emit('guest-upgrade', true);
    oldStatus = oStatus;
  }
};
const handleSignOut = async () => {
  if (await auth.signOut()) {
    show.value = false;
    router.push('/');
  }
};
const handleUpgradeRetry = () => {
  emit('guest-upgrade', false);
  auth.status = oldStatus;
};

onMounted(() => (show.value = true));
</script>

<template>
  <Transition @after-leave="emit('dismiss')" name="fade-down" appear>
    <Backdrop v-if="show" :show="show" @dismiss="show = !show" clear>
      <aside @pointerup.stop="noop" class="profile">
        <section class="info">
          <span class="name">{{ auth.profile?.username }}</span>
        </section>
        <section class="status">{{ !isVerified ? 'Not verified' : 'Verified' }}</section>
        <section v-if="!isVerified && !isGuestUpgrading" class="verify">
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
        <section v-if="!isVerified && isGuestUpgrading" class="guest-upgrade">
          <h5>
            Verification link sent to <span class="upgrade-email">{{ email }}</span>
          </h5>
          <Button :action="handleUpgradeRetry" :size="0.75">Change E-mail</Button>
        </section>
        <section class="stats">
          <div class="keys">
            <h3>Matches Played</h3>
            <h3>Matches Won</h3>
            <h3>Total Points</h3>
          </div>
          <div class="values">
            <h3>{{ auth.profile?.stats?.matches ?? 0 }}</h3>
            <h3>{{ auth.profile?.stats?.wins ?? 0 }}</h3>
            <h3>{{ auth.profile?.stats?.points ?? 0 }}</h3>
          </div>
        </section>
        <section class="controls">
          <Button icon="sign-out" :action="handleSignOut" :size="0.75" icon-left async> Signout </Button>
        </section>
      </aside>
    </Backdrop>
  </Transition>
</template>

<style scoped>
.profile {
  max-width: 20rem;
  min-width: 15rem;
  position: fixed;
  right: 0;
  top: var(--header-height);
  z-index: 100;
  box-shadow: 0px 0px 10px 0px #000;
  background-color: #c9b18b;
  background-image: url('/assets/images/dirt-overlay.png');
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

.profile .stats {
  margin-top: 1rem;
  display: flex;
  font-size: 0.75rem;
}
.profile .stats .keys {
  margin-right: 1rem;
}
.profile .stats .values {
  margin: 0 1rem;
}
</style>
