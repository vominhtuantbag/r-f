export {
  ensureRiderProfile,
  fetchProfile,
  mapProfileToUser,
  mockUserForRole,
  resolveUserFromSession,
  tokensFromSession,
  type ProfileRow,
} from './profile';

export {
  buildAuthSessionFromSupabase,
  getCurrentAuthSession,
  onAuthStateChange,
  signOut,
  type AuthStateListener,
} from './session';

export {
  normalizeAuthPhone,
  signInWithPhonePassword,
  signUpRider,
  type AppAuthRole,
  type SignInWithPhonePasswordOptions,
  type SignUpRiderOptions,
  type SignUpRiderResult,
} from './phone';

export {
  completeGoogleOAuthFromRedirectUrl,
  createMockGoogleAuthSession,
  signInWithGoogle,
  type GoogleAuthRole,
  type GoogleSignInOptions,
  type GoogleSignInResult,
} from './google';
