
const socket = io();

const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageContainer = document.getElementById('message-container');
const logoutButton = document.getElementById('logout-button');

let currentUser = null;


document.getElementById('login-button').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            authContainer.style.display = 'none';
            chatContainer.style.display = 'block';
            socket.emit('user joined', currentUser);
        } else {
            alert('Login failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

// Register
document.getElementById('register-button').addEventListener('click', async () => {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            alert('Registration successful. Please login.');
        } else {
            alert('Registration failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

// Logout
logoutButton.addEventListener('click', async () => {
    try {
        const response = await fetch('/logout');
        if (response.ok) {
            currentUser = null;
            authContainer.style.display = 'block';
            chatContainer.style.display = 'none';
            socket.emit('user left', currentUser);
        } else {
            alert('Logout failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    if (message && currentUser) {
        socket.emit('chat message', { user: currentUser, content: message });
        messageInput.value = '';
    }
});

socket.on('chat message', (msg) => {
    displayMessage(msg);
});

socket.on('user joined', (username) => {
    displaySystemMessage(`${username} has joined the chat`);
});

socket.on('user left', (username) => {
    displaySystemMessage(`${username} has left the chat`);
});

socket.on('message history', (messages) => {
    messageContainer.innerHTML = '';
    messages.forEach(displayMessage);
});

function displayMessage(msg) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${new Date(msg.timestamp).toLocaleString()} - ${msg.user}: ${msg.content}`;
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function displaySystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.fontStyle = 'italic';
    messageElement.style.color = '#888';
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Implement typing indicator
let typingTimeout;
messageInput.addEventListener('input', () => {
    if (currentUser) {
        socket.emit('typing', currentUser);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop typing', currentUser);
        }, 1000);
    }
});

socket.on('typing', (username) => {
    displayTypingIndicator(`${username} is typing...`);
});

socket.on('stop typing', (username) => {
    removeTypingIndicator(username);
});

function displayTypingIndicator(message) {
    const typingElement = document.getElementById('typing-indicator');
    typingElement.textContent = message;
}

function removeTypingIndicator(username) {
    const typingElement = document.getElementById('typing-indicator');
    if (typingElement.textContent.startsWith(`${username} is typing`)) {
        typingElement.textContent = '';
    }
}

// Implement user presence status
socket.on('user status', (users) => {
    updateUserList(users);
});

function updateUserList(users) {
    const userListElement = document.getElementById('user-list');
    userListElement.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        userListElement.appendChild(li);
    });
}