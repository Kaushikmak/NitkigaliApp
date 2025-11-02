document.addEventListener('DOMContentLoaded', () => {
    const RAILWAY_HOST = 'nitkigali-production.up.railway.app'; 
  
    // --- Screen and Button Elements ---
    const findChatBtn = document.getElementById('find-chat-btn');
    const skipBtn = document.getElementById('skip-btn'); // Now on chat screen
    const statusText = document.getElementById('status-text');
    
    const waitingScreen = document.getElementById('waiting-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    const quitBtn = document.getElementById('quit-btn'); 
    const chatLog = document.getElementById('chat-log');
    const messageInput = document.getElementById('chat-message-input');
    const messageSubmit = document.getElementById('chat-message-submit');

    let chatSocket = null;
    let matchmakingSocket = null;
    let lastMessageSent = ""; 
    let manuallyQuit = false; // Flag to prevent auto-reconnect on "Quit"

    // --- Matchmaking Logic ---

    findChatBtn.addEventListener('click', () => {
        statusText.textContent = 'Connecting to matchmaking...';
        findChatBtn.disabled = true;  // Disable find button
        // No more skip button logic here
        
        const matchmakingUrl = `wss://${RAILWAY_HOST}/ws/find_chat/`;
        matchmakingSocket = new WebSocket(matchmakingUrl);

        matchmakingSocket.onopen = () => {
            statusText.textContent = 'Waiting for a partner...';
        };

        matchmakingSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.status === 'waiting') {
                statusText.textContent = 'Waiting for a partner...';
            }

            if (data.type === 'redirect') {
                const roomName = data.room_name;
                statusText.textContent = `Partner found! Joining room: ${roomName}`;
                
                matchmakingSocket.close();
                connectToChatRoom(roomName);
            }
        };

        matchmakingSocket.onclose = () => {
            // Only re-enable the button if we didn't find a match
            if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
                 statusText.textContent = 'Matchmaking connection closed.';
                 findChatBtn.disabled = false;
            }
        };

        matchmakingSocket.onerror = (e) => {
            console.error('Matchmaking socket error:', e);
            statusText.textContent = 'Error connecting to matchmaking. Check console.';
            findChatBtn.disabled = false;
        };
    });

    // --- New Skip Button Logic (for CHAT screen) ---
    skipBtn.addEventListener('click', () => {
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            manuallyQuit = false; // We WANT to reconnect
            addMessageToLog('[Skipping...]', 'system');
            chatSocket.close();
        }
    });


    // --- Chat Room Logic ---

    function connectToChatRoom(roomName) {
        manuallyQuit = false; // Reset flag for new chat
        waitingScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        skipBtn.classList.remove('hidden'); // Show skip button
        messageInput.focus();

        const chatUrl = `wss://${RAILWAY_HOST}/ws/chat/${roomName}/`;
        chatSocket = new WebSocket(chatUrl);

        chatSocket.onopen = () => {
            addMessageToLog('Connected.', 'system');
        };

        chatSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            const message = data.message;
            
            if (message.startsWith('[')) {
                addMessageToLog(message, 'system');
            } else if (message === lastMessageSent) {
                lastMessageSent = ""; // Clear the flag
            } else {
                addMessageToLog(message, 'partner');
            }
        };

        // --- AUTO-RECONNECT LOGIC ---
        chatSocket.onclose = () => {
            skipBtn.classList.add('hidden'); // Hide skip button on close

            if (manuallyQuit) {
                // User clicked "Quit". The quitBtn handler resets the UI.
                addMessageToLog('[You have disconnected]', 'system');
            } else {
                // Partner disconnected OR user clicked "Skip"
                addMessageToLog('[Partner disconnected. Finding new chat...]', 'system');
                
                // Wait 2 seconds so user can read the message
                setTimeout(() => {
                    chatScreen.classList.add('hidden');
                    waitingScreen.classList.remove('hidden');
                    chatLog.innerHTML = ''; // Clear chat
                    
                    // Automatically find a new chat
                    findChatBtn.click();
                }, 2000); 
            }
        };

        chatSocket.onerror = (e) => {
            console.error('Chat socket error:', e);
            addMessageToLog('[Connection error]', 'system');
        };
    }

    // --- Quit Button Logic (Updated) ---
    quitBtn.addEventListener('click', () => {
        manuallyQuit = true; // Set flag to PREVENT auto-reconnect
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.close();
        }

        // Manually reset UI immediately
        chatScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        chatLog.innerHTML = ''; // Clear chat log
        
        statusText.textContent = 'Click the button to find a chat partner.';
        findChatBtn.disabled = false;
        skipBtn.classList.add('hidden');
    });


    // --- Sending Messages ---
    messageSubmit.addEventListener('click', () => {
        sendMessage();
    });

    messageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = messageInput.value;
        if (message.trim() === '' || !chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        chatSocket.send(JSON.stringify({
            'message': message
        }));
        
        lastMessageSent = message; 
        addMessageToLog(message, 'self'); 
        messageInput.value = '';
    }

    // --- UI Helper Function ---
    function addMessageToLog(message, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', type); 
        
        const textElement = document.createElement('p');
        textElement.textContent = message;
        
        messageElement.appendChild(textElement);
        chatLog.appendChild(messageElement);

        chatLog.scrollTop = chatLog.scrollHeight;
    }
});