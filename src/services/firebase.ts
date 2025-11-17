import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDpOBBeFe6BhsdRdo0YtdwNjXT0JO4ZVj0",
  authDomain: "gen-lang-client-0620675983.firebaseapp.com",
  projectId: "gen-lang-client-0620675983",
  storageBucket: "gen-lang-client-0620675983.appspot.com",
  messagingSenderId: "116620127648",
  appId: "1:116620127648:web:a455edea4d7ece65e2c8c5",
  measurementId: "G-L1B793VXN4"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize and export Cloud Firestore
export const db = firebase.firestore();

// Initialize Analytics
export const analytics = firebase.analytics();
