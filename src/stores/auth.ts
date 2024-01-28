import { ref } from 'vue';
import { defineStore } from 'pinia';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  getAdditionalUserInfo,
  User,
  Unsubscribe,
  isSignInWithEmailLink,
  signInWithEmailLink,
  UserCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { sendSignInLinkToEmail, linkWithCredential } from 'firebase/auth';

import { useRemoteDBStore } from './remote';
import * as local from '@/database/driver';
import { app, remoteDB } from '@/config/firebase';
import { Profile } from '@/interfaces/auth';
import { AuthStatus, AuthType, Null } from '@/interfaces/types';

const auth = getAuth(app);
auth.useDeviceLanguage();

export const useAuthStore = defineStore('auth', () => {
  const remote = useRemoteDBStore();
  const user = ref<Null<User>>(null);
  const profile = ref<Null<Profile>>(null);
  const status = ref<AuthStatus>('pending');
  const unsubFn = ref<Null<Unsubscribe>>(null);

  function registerAuthListener() {
    if (unsubFn.value) return;

    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        user.value = usr;
        if (status.value !== 'signed-in') {
          await handleExistingUser(user.value);
          status.value = 'signed-in';
        }
      } else {
        status.value = 'signed-out';
      }
    });
    unsubFn.value = unsubscribe;
  }
  function deRegisterAuthListener() {
    unsubFn.value?.();
  }
  async function updateUserProfile(prfl: Profile) {
    await remote.updateProfile(prfl);
  }
  async function loadUserProfile(uid: string) {
    const snap = await getDoc(doc(remoteDB, 'users', uid));
    profile.value = snap.data() as Profile;
  }
  async function handleNewUser(usr: User, username: string | null = null) {
    const prfl: Profile = {
      id: usr.uid,
      username,
      email: usr.email
    };
    await remote.storeProfile(prfl);
    await local.updateProfile(prfl);
    profile.value = prfl;
  }
  async function handleExistingUser(usr: User) {
    await loadUserProfile(usr.uid);
  }
  async function signIn(
    type: AuthType,
    email: string | null,
    link?: string,
    isUpgrade: boolean = false
  ) {
    status.value = 'pending';
    try {
      if (type === 'email' && email) {
        window.localStorage.setItem('email', email);
        await sendSignInLinkToEmail(auth, email, {
          url: `https://${window.location.hostname}auth?type=${isUpgrade ? 'upgrade' : 'init'}`,
          handleCodeInApp: true
        });
      } else if (type === 'verify') {
        if (link && isSignInWithEmailLink(auth, link)) {
          if (!email) {
            status.value = 'blocked';
          } else {
            await handleSignInWithEmailLink(email, link);
          }
        }
      } else if (type === 'guest') {
        await handleSignInWithAnonymous();
      } else if (type === 'guest-verify' && email && link && user.value) {
        const credential = EmailAuthProvider.credentialWithLink(email, link);
        const { user: usr } = await linkWithCredential(user.value, credential);
        user.value = usr;
        await handleNewUser(usr, profile.value?.username);
      }
    } catch (error) {
      console.log(error);
      // TODO: Notify
      /* notify.push({
          type: 'snackbar',
          status: 'warn',
          message: 'Something went wrong, please try again'
        }); */
    }
  }
  async function handleSignInWithEmailLink(email: string, link: string) {
    window.localStorage.removeItem('email');
    const result = await signInWithEmailLink(auth, email, link);
    await handleSignInSuccess(result);
  }
  async function handleSignInWithAnonymous() {
    const result = await signInAnonymously(auth);
    await handleSignInSuccess(result);
  }
  async function handleSignInSuccess(result?: UserCredential) {
    if (result) {
      if (getAdditionalUserInfo(result)?.isNewUser) {
        await handleNewUser(result.user);
      } else {
        await handleExistingUser(result.user);
      }
      status.value = 'signed-in';
    } else {
      throw new Error('Failed to sign-in');
    }
  }
  async function signOut() {
    try {
      await auth.signOut();
      user.value = null;
      profile.value = null;
    } catch (error) {
      console.log(error);
      // TODO: Notify
      /* notify.push({
        type: 'snackbar',
        status: 'warn',
        message: 'Something went wrong, please try again'
      }); */
    }
  }
  function isVerificationLink(link: string) {
    return isSignInWithEmailLink(auth, link);
  }

  return {
    user,
    status,
    profile,
    registerAuthListener,
    deRegisterAuthListener,
    signIn,
    signOut,
    updateUserProfile,
    isVerificationLink
  };
});
