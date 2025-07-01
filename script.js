// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAKO8FN5RztfJ4vqVO-2BksvDjin2naPBw",
  authDomain: "anonymous-messge-5ac05.firebaseapp.com",
  projectId: "anonymous-messge-5ac05",
  storageBucket: "anonymous-messge-5ac05.appspot.com",
  messagingSenderId: "328794885867",
  appId: "1:328794885867:web:2199b6b362b16cec8978ae",
  measurementId: "G-Z8EFD1R4GW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const usersRef = db.collection("users");
const confessionsRef = db.collection("confessions");

// DOM Elements
const authButtons = document.getElementById('authButtons');
const userMenu = document.getElementById('userMenu');
const usernameDisplay = document.getElementById('usernameDisplay');
const userAvatar = document.getElementById('userAvatar');
const userLink = document.getElementById('userLink');
const dashboardLink = document.getElementById('dashboardLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const recipientLink = document.getElementById('recipientLink');
const confessionInput = document.getElementById('confessionInput');
const sendConfessionBtn = document.getElementById('sendConfessionBtn');
const confessionStatus = document.getElementById('confessionStatus');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const logoutBtn = document.getElementById('logoutBtn');
const particles = document.getElementById('particles');
const privacyLink = document.getElementById('privacyLink');

// State
let currentUser = null;
let userProfile = null;

// Generate unique link ID
function generateLinkID() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create particles background
function createParticles() {
  const particleCount = Math.floor(window.innerWidth / 15);
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    
    const size = Math.random() * 3 + 1;
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * -20;
    const opacity = Math.random() * 0.3 + 0.1;
    
    particle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${posX}%;
      top: ${posY}%;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      opacity: ${opacity};
      background: rgba(255, 255, 255, ${Math.random() * 0.4 + 0.1});
    `;
    
    particles.appendChild(particle);
  }
}

// Auth state listener
auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    // User is signed in
    authButtons.style.display = 'none';
    userMenu.style.display = 'flex';
    
    // Get user profile
    const userDoc = await usersRef.doc(user.uid).get();
    if (userDoc.exists) {
      userProfile = userDoc.data();
      
      // Display user info
      const displayName = user.displayName || "Anonymous User";
      usernameDisplay.textContent = displayName;
      userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`;
      
      // Display user link
      userLink.value = `${window.location.origin}/u/${userProfile.linkID}`;
      dashboardLink.href = `dashboard.html?uid=${user.uid}`;
    } else {
      // Create user profile if it doesn't exist
      const linkID = generateLinkID();
      await usersRef.doc(user.uid).set({
        uid: user.uid,
        displayName: user.displayName || "Anonymous User",
        email: user.email,
        linkID: linkID,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "Anonymous")}&background=random&color=fff`
      });
      
      userProfile = {
        linkID: linkID,
        displayName: user.displayName || "Anonymous User"
      };
      
      userLink.value = `${window.location.origin}/u/${linkID}`;
      dashboardLink.href = `dashboard.html?uid=${user.uid}`;
    }
  } else {
    // User is signed out
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
    userLink.value = "Login to get your unique link";
    dashboardLink.href = "#";
  }
});

// Event Listeners
copyLinkBtn.addEventListener('click', () => {
  userLink.select();
  document.execCommand('copy');
  showStatus('Link copied to clipboard!', 'success');
});

sendConfessionBtn.addEventListener('click', async () => {
  const link = recipientLink.value.trim();
  const message = confessionInput.value.trim();
  
  if (!link) {
    showStatus('Please enter a recipient link', 'error');
    return;
  }
  
  if (!message) {
    showStatus('Please enter a confession message', 'error');
    return;
  }
  
  // Extract link ID from URL
  const linkParts = link.split('/');
  const linkID = linkParts[linkParts.length - 1];
  
  try {
    // Get recipient user by link ID
    const userQuery = await usersRef.where('linkID', '==', linkID).limit(1).get();
    
    if (userQuery.empty) {
      showStatus('User not found. Please check the link', 'error');
      return;
    }
    
    const recipient = userQuery.docs[0].data();
    
    // Save confession
    await confessionsRef.add({
      toUserID: recipient.uid,
      message: message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      isRead: false
    });
    
    showStatus('Confession sent successfully!', 'success');
    confessionInput.value = '';
  } catch (error) {
    console.error('Error sending confession:', error);
    showStatus('Failed to send confession. Please try again.', 'error');
  }
});

loginBtn.addEventListener('click', () => {
  window.location.href = 'register.html';
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

dashboardBtn.addEventListener('click', () => {
  if (currentUser) {
    window.location.href = `dashboard.html?uid=${currentUser.uid}`;
  }
});

privacyLink.addEventListener('click', (e) => {
  e.preventDefault();
  alert(`Privacy Policy:\n\n` +
        `• All messages are completely anonymous\n` +
        `• No personal information is collected\n` +
        `• Messages are stored securely\n` +
        `• Inappropriate content may be removed\n` +
        `• Data is never shared with third parties`);
});

function showStatus(message, type) {
  confessionStatus.textContent = message;
  confessionStatus.className = type;
  confessionStatus.style.display = 'block';
  
  setTimeout(() => {
    confessionStatus.style.display = 'none';
  }, 5000);
}

// Initialize
createParticles();