document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-container");
    const chatButton = document.getElementById("ai-button");
    const closeButton = document.getElementById("close-btn");
    const sendButton = document.getElementById("send-btn");
    const chatInput = document.getElementById("chat-text");
    const chatBody = document.getElementById("chat-body");

    // all elements exist
    if (!chatBox || !chatButton || !closeButton || !sendButton || !chatInput || !chatBody) {
        console.error("Chat elements not found!");
        return;
    }

    // Toggle chat visibility when the button is clicked
    chatButton.addEventListener("click", function () {
        chatBox.classList.toggle("chat-visible");
    });

    closeButton.addEventListener("click", function () {
        chatBox.classList.remove("chat-visible");
    });

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            // Add user message to chat
            addMessageToChat("user", message);

            // Clear input
            chatInput.value = "";

            // Show loading indicator
            const loadingMsg = addMessageToChat("assistant", "Thinking...");

            // Send to backend
            fetch("/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: message }),
            })
            .then(response => response.json())
            .then(data => {
                // Remove loading message
                if (loadingMsg) {
                    chatBody.removeChild(loadingMsg);
                }
                addMessageToChat("assistant", data.response);
                chatBody.scrollTop = chatBody.scrollHeight;
            })
            .catch(error => {
                console.error("Error:", error);
                // Remove loading message
                if (loadingMsg) {
                    chatBody.removeChild(loadingMsg);
                }
                addMessageToChat("assistant", "Sorry, there was an error processing your request.");
            });
        }
    }

    function addMessageToChat(sender, message) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("chat-message", sender);
        messageElement.innerHTML = message; 
        chatBody.appendChild(messageElement);
        chatBody.scrollTop = chatBody.scrollHeight;
        return messageElement;
    }

    sendButton.addEventListener("click", sendMessage);

    chatInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });

    // Add initial welcome message
    setTimeout(() => {
        addMessageToChat("assistant", "Hi there! I'm your Smart Saver assistant. How can I help you with financial planning today?");
    }, 500);
});
