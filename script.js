/* ------------- Anonymous Message Wall ------------- *
     *  Added comment feature, improved UI
     *  Updated: 21 Jun 2025
     * --------------------------------------------------- */

    /* ---------------- Firebase Setup ------------------ */
    const firebaseConfig = {
      apiKey: "AIzaSyAKO8FN5RztfJ4vqVO-2BksvDjin2naPBw",
      authDomain: "anonymous-messge-5ac05.firebaseapp.com",
      projectId: "anonymous-messge-5ac05",
      storageBucket: "anonymous-messge-5ac05.firebasestorage.app",
      messagingSenderId: "328794885867",
      appId: "1:328794885867:web:2199b6b362b16cec8978ae",
      measurementId: "G-Z8EFD1R4GW"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const confessionsRef = db.collection("confessions");
    const PAGE_SIZE = 50;

    /* ---------------- DOM Elements -------------------- */
    const form = document.getElementById('confessionForm');
    const textarea = document.getElementById('confessionInput');
    const charCount = document.getElementById('charCount');
    const confessionsContainer = document.getElementById('confessionsContainer');
    const errorMsg = document.getElementById('errorMsg');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('emptyState');
    const privacyLink = document.getElementById('privacyLink');
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more';
    loadMoreBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Load More Messages';
    loadMoreBtn.style.display = 'none';

    // Create container for load more button
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.id = 'loadMoreContainer';
    loadMoreContainer.style.textAlign = 'center';
    loadMoreContainer.style.margin = '20px 0';
    document.querySelector('.confessions-feed').appendChild(loadMoreContainer);

    /* ---------------- State Management ---------------- */
    let lastVisible = null;
    let isFetching = false;
    let hasMoreMessages = true;
    let unsubscribeListener = null;
    const LIKED_MESSAGES_KEY = 'likedMessages';

    /* ---------------- Utilities ----------------------- */
    const showError = (message) => {
      errorMsg.textContent = message;
      errorMsg.style.color = '#e53935';
      errorMsg.style.display = 'block';
      setTimeout(() => errorMsg.style.display = 'none', 5000);
    };

    const showSuccess = (message) => {
      errorMsg.textContent = message;
      errorMsg.style.color = '#34a853';
      errorMsg.style.display = 'block';
      setTimeout(() => errorMsg.style.display = 'none', 3000);
    };

    const escapeHTML = (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };

    const isRateLimited = () => {
      const lastPostTime = localStorage.getItem('lastConfessionTime');
      if (!lastPostTime) return false;
      return (Date.now() - parseInt(lastPostTime, 10)) / 1000 < 30;
    };

    const setRateLimit = () => {
      localStorage.setItem('lastConfessionTime', Date.now().toString());
    };

    const formatDate = (date) => {
      const now = new Date();
      const diffMs = now - date;
      
      if (diffMs < 60000) return "Just now";
      if (diffMs < 3600000) {
        const mins = Math.floor(diffMs / 60000);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
      }
      if (diffMs < 86400000) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `Today at ${hours}:${minutes}`;
      }
      if (diffMs < 604800000) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[date.getDay()]} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    /* -------------- Character Counter ----------------- */
    textarea.addEventListener('input', () => {
      const length = textarea.value.length;
      charCount.textContent = `${length}/1000`;
      charCount.style.color = length > 900 ? "#e53935" : "#5f6368";
      charCount.style.fontWeight = length > 900 ? "600" : "normal";
    });

    /* -------------- Real-time Feed -------------------- */
    const setupRealtimeListener = () => {
      loader.style.display = 'flex';
      if (emptyState) emptyState.style.display = 'none';

      if (unsubscribeListener) unsubscribeListener();

      const query = confessionsRef.orderBy("timestamp", "desc").limit(PAGE_SIZE);

      unsubscribeListener = query.onSnapshot(snapshot => {
        console.log("Messages are now being shown…");

        confessionsContainer.innerHTML = '';
        loader.style.display = 'none';
        loadMoreContainer.innerHTML = '';
        loadMoreBtn.style.display = 'none';

        if (snapshot.empty) {
          if (emptyState) {
            emptyState.style.display = 'block';
            const msg = emptyState.querySelector('p');
            if (msg) msg.textContent = "No messages yet. Be the first to share!";
          }
          return;
        }

        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        hasMoreMessages = snapshot.docs.length >= PAGE_SIZE;

        snapshot.forEach(doc => {
          const data = doc.data();
          const confession = {
            id: doc.id,
            text: data.text || "No content",
            likes: data.likes || 0,
            timestamp: data.timestamp?.toDate() || new Date(),
            commentCount: data.commentCount || 0
          };
          addConfessionToFeed(confession);
        });

        if (hasMoreMessages) {
          loadMoreContainer.appendChild(loadMoreBtn);
          loadMoreBtn.style.display = 'block';
        }

        isFetching = false;

      }, err => {
        console.error("Realtime listener error:", err);
        loader.style.display = 'none';
        if (emptyState) {
          emptyState.style.display = 'block';
          const msg = emptyState.querySelector('p');
          if (msg) msg.textContent = "Failed to load messages. Please refresh.";
        }
      });
    };

    /* -------------- Pagination ------------------------ */
    const loadMoreMessages = async () => {
      if (isFetching || !lastVisible || !hasMoreMessages) return;
      
      isFetching = true;
      loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
      loadMoreBtn.disabled = true;
      
      try {
        const nextQuery = confessionsRef.orderBy("timestamp", "desc")
          .startAfter(lastVisible)
          .limit(PAGE_SIZE);
          
        const snapshot = await nextQuery.get();
        
        if (snapshot.empty) {
          hasMoreMessages = false;
          loadMoreBtn.style.display = 'none';
          return;
        }
        
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        hasMoreMessages = snapshot.docs.length >= PAGE_SIZE;
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const confession = {
            id: doc.id,
            text: data.text || "No content",
            likes: data.likes || 0,
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
            commentCount: data.commentCount || 0
          };
          addConfessionToFeed(confession);
        });
        
      } catch (err) {
        console.error("Error loading more messages:", err);
        showError("Failed to load more messages");
      } finally {
        isFetching = false;
        loadMoreBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Load More Messages';
        loadMoreBtn.disabled = false;
        
        if (!hasMoreMessages) {
          loadMoreBtn.style.display = 'none';
        }
      }
    };

    loadMoreBtn.addEventListener('click', loadMoreMessages);

    /* -------------- Form Submit ----------------------- */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const confessionText = textarea.value.trim();

      // Validation
      if (!confessionText) {
        showError("Message can't be empty");
        return;
      }
      
      if (confessionText.length > 1000) {
        showError("Message is too long (max 1000 characters)");
        return;
      }
      
      if (isRateLimited()) {
        showError("Please wait 30 seconds between messages");
        return;
      }

      const submitBtn = form.querySelector('button');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

      try {
        // Add to Firestore
        await confessionsRef.add({
          text: confessionText,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          likes: 0,
          commentCount: 0
        });

        textarea.value = '';
        charCount.textContent = '0/1000';
        charCount.style.color = "#5f6368";
        showSuccess("Message posted successfully!");
        setRateLimit();
        
        // Scroll to top to see new message
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
      } catch (err) {
        console.error("Error adding confession:", err);
        showError("Failed to post. Please try again.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Message';
      }
    });

    /* -------------- Comment Functions ---------------- */
    const loadComments = async (confessionId, commentsList) => {
      // Show loading state
      commentsList.innerHTML = '<div class="comment-loader"><div class="loader-spinner"></div></div>';
      
      try {
        const commentsSnapshot = await db.collection('confessions').doc(confessionId)
          .collection('comments')
          .orderBy('timestamp', 'asc')
          .get();
        
        commentsList.innerHTML = '';
        
        if (commentsSnapshot.empty) {
          commentsList.innerHTML = '<div class="no-comments">No perceptions yet. Be the first to share your view!</div>';
          return;
        }
        
        commentsSnapshot.forEach(doc => {
          const comment = doc.data();
          const commentEl = document.createElement('div');
          commentEl.className = 'comment';
          commentEl.innerHTML = `
            <div class="comment-header">
              <span>Anonymous Perception</span>
              <span class="comment-time">${formatDate(comment.timestamp?.toDate() || new Date())}</span>
            </div>
            <p class="comment-text">${escapeHTML(comment.text)}</p>
          `;
          commentsList.appendChild(commentEl);
        });
      } catch (err) {
        console.error("Error loading comments:", err);
        commentsList.innerHTML = '<div class="no-comments">Failed to load perceptions. Please try again.</div>';
      }
    };

    const postComment = async (confessionId, commentText, commentForm) => {
      const submitBtn = commentForm.querySelector('.comment-submit');
      const input = commentForm.querySelector('.comment-input');
      
      // Validation
      if (!commentText) {
        showError("Perception can't be empty");
        return;
      }
      
      if (commentText.length > 500) {
        showError("Perception is too long (max 500 characters)");
        return;
      }
      
      // Disable form during submission
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';
      input.disabled = true;
      
      try {
        // Add comment to Firestore
        await db.collection('confessions').doc(confessionId).collection('comments').add({
          text: commentText,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update comment count on confession
        await db.collection('confessions').doc(confessionId).update({
          commentCount: firebase.firestore.FieldValue.increment(1)
        });
        
        // Clear input
        input.value = '';
        showSuccess("Perception posted!");
        
        // Reload comments
        const commentsList = commentForm.closest('.comments-container').querySelector('.comments-list');
        await loadComments(confessionId, commentsList);
        
        // Update comment count in UI
        const confessionCard = commentForm.closest('.confession-card');
        const commentCount = confessionCard.querySelector('.comment-count');
        const currentCount = parseInt(commentCount.textContent) || 0;
        commentCount.textContent = currentCount + 1;
        
      } catch (err) {
        console.error("Error posting comment:", err);
        showError("Failed to post perception");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
        input.disabled = false;
      }
    };

    /* -------------- Confession Card ------------------- */
    const createConfessionElement = (confession) => {
      const el = document.createElement('div');
      el.className = 'confession-card';
      el.dataset.id = confession.id;

      // Check if user has liked this message
      const likedMessages = JSON.parse(localStorage.getItem(LIKED_MESSAGES_KEY)) || [];
      const isLiked = likedMessages.includes(confession.id);
      
      el.innerHTML = `
        <p class="confession-text">${escapeHTML(confession.text)}</p>
        <div class="confession-footer">
          <span class="confession-time">
            <i class="far fa-clock"></i>
            ${formatDate(confession.timestamp)}
          </span>
          <div class="confession-actions">
            <button class="action-btn like-btn" title="Like">
              <i class="${isLiked ? 'fas' : (confession.likes > 0 ? 'fas' : 'far')} fa-heart"></i>
              <span class="like-count">${confession.likes}</span>
            </button>
            <button class="action-btn share-btn" title="Share">
              <i class="fas fa-share-alt"></i>
            </button>
          </div>
        </div>
        <div class="comments-section">
          <div class="comments-header">
            <h3><i class="fas fa-comments"></i> Perceptions (<span class="comment-count">${confession.commentCount}</span>)</h3>
            <button class="view-comments-btn collapsed">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="comments-container">
            <div class="comments-list"></div>
            <form class="comment-form">
              <input type="text" class="comment-input" placeholder="Share your perception..." maxlength="500" required>
              <div class="comment-char-count">0/500</div>
              <button type="submit" class="comment-submit">Post</button>
            </form>
          </div>
        </div>
      `;

      const likeBtn = el.querySelector('.like-btn');
      const shareBtn = el.querySelector('.share-btn');
      const viewCommentsBtn = el.querySelector('.view-comments-btn');
      const commentsContainer = el.querySelector('.comments-container');
      const commentForm = el.querySelector('.comment-form');
      const commentInput = el.querySelector('.comment-input');
      const commentCharCount = el.querySelector('.comment-char-count');

      // Like functionality
      likeBtn.addEventListener('click', async () => {
        const messageId = confession.id;
        let likedMessages = JSON.parse(localStorage.getItem(LIKED_MESSAGES_KEY)) || [];
        
        // Check if already liked
        if (likedMessages.includes(messageId)) {
          showError("You've already liked this message!");
          return;
        }
        
        if (likeBtn.classList.contains('disabled')) return;
        
        const likeCountSpan = likeBtn.querySelector('.like-count');
        const heartIcon = likeBtn.querySelector('i');
        const currentLikes = parseInt(likeCountSpan.textContent, 10);
        
        likeBtn.classList.add('disabled');
        
        try {
          // Optimistic update
          likeCountSpan.textContent = currentLikes + 1;
          heartIcon.classList.replace('far', 'fas');
          heartIcon.classList.add('fa-beat');
          
          await confessionsRef.doc(confession.id).update({
            likes: firebase.firestore.FieldValue.increment(1)
          });
          
          // Record like in localStorage
          likedMessages.push(messageId);
          localStorage.setItem(LIKED_MESSAGES_KEY, JSON.stringify(likedMessages));
          
        } catch (err) {
          // Revert on failure
          console.error("Error updating like:", err);
          likeCountSpan.textContent = currentLikes;
          heartIcon.classList.replace('fas', 'far');
          showError("Failed to like. Please try again.");
        } finally {
          setTimeout(() => {
            heartIcon.classList.remove('fa-beat');
            likeBtn.classList.remove('disabled');
          }, 500);
        }
      });

      // Share functionality
      shareBtn.addEventListener('click', () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?confession=${confession.id}`;
        
        if (navigator.share) {
          navigator.share({
            title: 'Anonymous Confession',
            text: 'Check out this anonymous confession:',
            url: shareUrl
          }).catch(console.error);
        } else {
          navigator.clipboard.writeText(shareUrl).then(() => {
            showSuccess("Link copied to clipboard!");
          });
        }
      });

      // View comments toggle
      viewCommentsBtn.addEventListener('click', () => {
        const isExpanded = viewCommentsBtn.classList.contains('expanded');
        
        if (isExpanded) {
          viewCommentsBtn.classList.remove('expanded');
          viewCommentsBtn.classList.add('collapsed');
          commentsContainer.classList.remove('expanded');
        } else {
          viewCommentsBtn.classList.remove('collapsed');
          viewCommentsBtn.classList.add('expanded');
          commentsContainer.classList.add('expanded');
          
          // Load comments if not already loaded
          const commentsList = commentsContainer.querySelector('.comments-list');
          if (commentsList.children.length === 0) {
            loadComments(confession.id, commentsList);
          }
        }
      });

      // Comment character counter
      commentInput.addEventListener('input', () => {
        const length = commentInput.value.length;
        commentCharCount.textContent = `${length}/500`;
        commentCharCount.style.color = length > 400 ? "#e53935" : "#5f6368";
      });

      // Comment form submit
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const commentText = commentInput.value.trim();
        postComment(confession.id, commentText, commentForm);
      });

      return el;
    };

    /* -------------- Feed Helpers ---------------------- */
    const addConfessionToFeed = (confession, prepend = false) => {
      if (emptyState) emptyState.style.display = 'none';
      
      // Check if confession already exists
      const existing = document.querySelector(`.confession-card[data-id="${confession.id}"]`);
      if (existing) return;
      
      const element = createConfessionElement(confession);
      
      if (prepend) {
        confessionsContainer.insertBefore(element, confessionsContainer.firstChild);
      } else {
        confessionsContainer.appendChild(element);
      }
    };

    /* -------------- Particles Bg ---------------------- */
    const createParticles = () => {
      const container = document.getElementById('particles');
      if (!container) return;

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
        
        container.appendChild(particle);
      }
    };

    /* -------------- Privacy Policy -------------------- */
    privacyLink?.addEventListener('click', (e) => {
      e.preventDefault();
      alert(`Privacy Policy:\n\n` +
            `• All messages are completely anonymous\n` +
            `• No personal information is collected\n` +
            `• Messages are stored securely\n` +
            `• Inappropriate content may be removed\n` +
            `• Data is never shared with third parties`);
    });

    /* -------------- URL Confession Loader ------------- */
    const loadSpecificConfession = async (id) => {
      try {
        const doc = await confessionsRef.doc(id).get();
        if (doc.exists) {
          const data = doc.data();
          const confession = {
            id: doc.id,
            text: data.text || "No content",
            likes: data.likes || 0,
            timestamp: data.timestamp.toDate(),
            commentCount: data.commentCount || 0
          };
          
          confessionsContainer.innerHTML = '';
          addConfessionToFeed(confession);
          loader.style.display = 'none';
          
          document.title = `Confession #${id.substring(0, 6)} - Anonymous Wall`;
          
          setTimeout(() => {
            const card = document.querySelector('.confession-card');
            if (card) card.scrollIntoView({ behavior: 'smooth' });
            
            // Expand comments by default for direct links
            const viewCommentsBtn = card.querySelector('.view-comments-btn');
            viewCommentsBtn.classList.remove('collapsed');
            viewCommentsBtn.classList.add('expanded');
            const commentsContainer = card.querySelector('.comments-container');
            commentsContainer.classList.add('expanded');
            
            // Load comments
            const commentsList = commentsContainer.querySelector('.comments-list');
            loadComments(confession.id, commentsList);
          }, 300);
        } else {
          showError("Confession not found or expired");
          setTimeout(() => window.location.search = "", 3000);
        }
      } catch (err) {
        console.error("Error loading confession:", err);
        showError("Error loading confession");
        setTimeout(setupRealtimeListener, 3000);
      }
    };

    /* -------------- Init ------------------------------ */
    const initApp = () => {
      createParticles();
      
      // Check for direct confession link
      const urlParams = new URLSearchParams(window.location.search);
      const confessionId = urlParams.get('confession');
      
      if (confessionId) {
        loader.style.display = 'flex';
        loadSpecificConfession(confessionId);
      } else {
        setupRealtimeListener();
      }
    };

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initApp);

    // Clean up on exit
    window.addEventListener('beforeunload', () => {
      if (unsubscribeListener) unsubscribeListener();
    });