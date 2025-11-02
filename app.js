document.addEventListener('DOMContentLoaded', () => {
    const RAILWAY_HOST = 'https://nitkigali.onrender.com'; 
  


    if (RAILWAY_HOST === 'your-railway-app-url.up.railway.app') {
        alert('Please open app.js and set the RAILWAY_HOST variable to your Railway app domain!');
    }

    const findChatBtn = document.getElementById('find-chat-btn');
    const statusText = document.getElementById('status-text');
    
    const waitingScreen = document.getElementById('waiting-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    const chatLog = document.getElementById('chat-log');
    const messageInput = document.getElementById('chat-message-input');
    const messageSubmit = document.getElementById('chat-message-submit');

    let chatSocket = null;
    let matchmakingSocket = null;

    // --- Matchmaking Logic ---

    findChatBtn.addEventListener('click', () => {
        statusText.textContent = 'Connecting to matchmaking...';
        
        // Connect to the matchmaking WebSocket
        const matchmakingUrl = `wss://${RAILWAY_HOST}/ws/find_chat/`;
        matchmakingSocket = new WebSocket(matchmakingUrl);

        matchmakingSocket.onopen = () => {
            statusText.textContent = 'Waiting for a partner...';
            findChatBtn.disabled = true;
        };

        matchmakingSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.status === 'waiting') {
                statusText.textContent = 'Waiting for a partner...';
            }

            // --- Redirect Received ---
            // The backend found a match and is redirecting us to a room
            if (data.type === 'redirect') {
                const roomName = data.room_name;
                statusText.textContent = `Partner found! Joining room: ${roomName}`;
                
                // Close the matchmaking socket and connect to the chat room
                matchmakingSocket.close();
                connectToChatRoom(roomName);
            }
        };

        matchmakingSocket.onclose = () => {
            statusText.textContent = 'Matchmaking connection closed.';
            findChatBtn.disabled = false;
        };

        matchmakingSocket.onerror = (e) => {
            console.error('Matchmaking socket error:', e);
            statusText.textContent = 'Error connecting to matchmaking. Check console.';
            findChatBtn.disabled = false;
        };
    });

    // --- Chat Room Logic ---

    function connectToChatRoom(roomName) {
        // Show the chat screenhttps://nitkighttps://nitkigali.onrender.comali.onrender.com
        waitingScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');

        // Connect to the chat room WebSocket
        const chatUrl = `wss://${RAILWAY_HOST}/ws/chat/${roomName}/`;
        chatSocket = new WebSocket(chatUrl);

        chatSocket.onopen = () => {
            addMessageToLog('Connected to chat room.', 'system');
        };

        // --- Message Received ---
        chatSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            const message = data.message;
            
            // Differentiate between system messages, partner messages, and our own
            if (message.startsWith('[')) {
                addMessageToLog(message, 'system');
            } else {
                // In this simple setup, we assume we didn't send it.
                // A more robust app would check a user ID.
                addMessageToLog(message, 'partner');
            }
        };

        chatSocket.onclose = () => {
            addMessageToLog('[You have been disconnected]', 'system');
        };

        chatSocket.onerror = (e) => {
            console.error('Chat socket error:', e);
            addMessageToLog('[Connection error]', 'system');
        };
    }

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

        // Send the message to the WebSocket
        chatSocket.send(JSON.stringify({
            'message': message
        }));

        // Add our own message to the log
        addMessageToLog(message, 'self');
        messageInput.value = '';
    }

    // --- UI Helper Function ---

    function addMessageToLog(message, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', type); // 'system', 'self', or 'partner'
        
        const textElement = document.createElement('p');
        textElement.textContent = message;
        
        messageElement.appendChild(textElement);
        chatLog.appendChild(messageElement);

        // Auto-scroll to the bottom
        chatLog.scrollTop = chatLog.scrollHeight;
    }
});