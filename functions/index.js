const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  const uid = context.auth.uid;

  try {
    // Delete all user data in Firestore (entire users/{uid} document tree)
    await db.collection('users').doc(uid).delete();

    // Delete auth user
    await auth.deleteUser(uid);

    return { success: true, message: 'Account and all data deleted' };
  } catch (error) {
    console.error('Delete account error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete account: ' + error.message);
  }
});
