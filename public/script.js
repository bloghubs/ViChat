
const socket = io();

let username = "";
let localStream = null;

const peers = {};
const peerNames = {};
const pendingIceCandidates = {};

const configuration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};

/* =========================
   ELEMENTS
========================= */

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const videoScreen = document.getElementById("videoScreen");

const usernameInput = document.getElementById("usernameInput");
const joinButton = document.getElementById("joinButton");
const loginError = document.getElementById("loginError");

const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");

const usersList = document.getElementById("usersList");
const onlineCount = document.getElementById("onlineCount");

const videoButton = document.getElementById("videoButton");
const closeVideoButton = document.getElementById("closeVideoButton");
const leaveVideoButton = document.getElementById("leaveVideoButton");

const muteButton = document.getElementById("muteButton");
const cameraButton = document.getElementById("cameraButton");

const videoGrid = document.getElementById("videoGrid");


/* =========================
   LOGIN
========================= */

function joinChat() {
    const name = usernameInput.value.trim();

    if (!name) {
        loginError.textContent = "Please enter a username.";
        return;
    }

    socket.emit("join", name);
}

joinButton.addEventListener("click", joinChat);

usernameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        joinChat();
    }
});

socket.on("joined", (name) => {
    username = name;

    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

    messageInput.focus();
});

socket.on("usernameError", (message) => {
    loginError.textContent = message;
});


/* =========================
   CHAT
========================= */

function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) {
        return;
    }

    socket.emit("sendMessage", message);

    messageInput.value = "";
}

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendMessage();
    }
});

socket.on("message", (data) => {
    const element = document.createElement("div");
    element.className = "message";

    const name = document.createElement("strong");
    name.textContent = data.username;

    const text = document.createElement("span");
    text.textContent = data.text;

    element.appendChild(name);
    element.appendChild(text);

    messages.appendChild(element);

    messages.scrollTop = messages.scrollHeight;
});

socket.on("systemMessage", (text) => {
    const element = document.createElement("div");

    element.className = "system-message";
    element.textContent = text;

    messages.appendChild(element);

    messages.scrollTop = messages.scrollHeight;
});

socket.on("users", (users) => {
    usersList.innerHTML = "";

    onlineCount.textContent = `${users.length} online`;

    users.forEach((user) => {
        const li = document.createElement("li");

        li.textContent = "🟢 " + user;

        usersList.appendChild(li);
    });
});


/* =====================================================
   VIDEO CHAT
===================================================== */

videoButton.addEventListener("click", startVideoChat);

closeVideoButton.addEventListener("click", leaveVideoChat);

leaveVideoButton.addEventListener("click", leaveVideoChat);


/* =====================================================
   START VIDEO
===================================================== */

async function startVideoChat() {

    if (localStream) {
        return;
    }

    /* Browser support */

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        alert(
            "Camera and microphone access is not supported by this browser."
        );

        return;
    }

    /*
       Camera and microphone require a secure context.

       HTTPS works.
       localhost works.

       A normal HTTP LAN address such as:
       http://192.168.1.10:3000

       will normally NOT work on mobile.
    */

    if (!window.isSecureContext) {
        alert(
            "Camera and microphone require HTTPS on mobile. " +
            "Open ViChat using an HTTPS address."
        );

        console.error(
            "getUserMedia blocked because the page is not secure."
        );

        return;
    }

    try {

        console.log("Requesting camera and microphone...");

        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 720
                }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        console.log("Camera and microphone started.");

        /*
           Show video screen
        */

        chatScreen.classList.add("hidden");
        videoScreen.classList.remove("hidden");

        /*
           Add our camera
        */

        addLocalVideo(localStream);

        /*
           Join WebRTC room
        */

        socket.emit("join-video");

    } catch (error) {

        console.error("getUserMedia error:", error);

        let message =
            "Could not start camera or microphone.";

        if (error.name === "NotAllowedError") {

            message =
                "Camera or microphone permission was denied. " +
                "Check your browser permissions and try again.";

        } else if (error.name === "NotFoundError") {

            message =
                "No camera or microphone was found on this device.";

        } else if (error.name === "NotReadableError") {

            message =
                "Your camera or microphone is already being used " +
                "by another app.";

        } else if (error.name === "OverconstrainedError") {

            message =
                "The camera does not support the requested settings.";

        } else if (error.name === "SecurityError") {

            message =
                "The browser blocked camera access for security reasons.";

        } else if (error.name === "TypeError") {

            message =
                "Camera access is unavailable. " +
                "Make sure you are using HTTPS.";

        }

        alert(message);
    }
}


/* =====================================================
   LOCAL VIDEO
===================================================== */

function addLocalVideo(stream) {

    /*
       Remove an old local video if one exists.
    */

    const oldContainer = document.getElementById(
        "localVideoContainer"
    );

    if (oldContainer) {
        oldContainer.remove();
    }

    /*
       Local video container
    */

    const container = document.createElement("div");

    container.className = "video-container";
    container.id = "localVideoContainer";

    /*
       Local video element
    */

    const video = document.createElement("video");

    video.id = "localVideo";

    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    video.srcObject = stream;

    /*
       Mobile browsers sometimes need
       play() explicitly.
    */

    video.play().catch((error) => {
        console.warn(
            "Local video play warning:",
            error
        );
    });

    /*
       Name
    */

    const label = document.createElement("div");

    label.className = "video-name";
    label.textContent = `${username} (You)`;

    container.appendChild(video);
    container.appendChild(label);

    videoGrid.appendChild(container);
}


/* =====================================================
   EXISTING VIDEO USERS
===================================================== */

socket.on("video-users", async (users) => {

    for (const user of users) {

        peerNames[user.socketId] = user.username;

        try {

            await createOffer(user.socketId);

        } catch (error) {

            console.error(
                "Offer error:",
                error
            );
        }
    }
});


/* =====================================================
   NEW VIDEO USER
===================================================== */

socket.on(
    "video-user-joined",
    ({ socketId, username: remoteUsername }) => {

        peerNames[socketId] = remoteUsername;
    }
);


/* =====================================================
   CREATE OFFER
===================================================== */

async function createOffer(target) {

    const peer = createPeer(target);

    try {

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        socket.emit("video-offer", {
            target: target,
            offer: offer
        });

    } catch (error) {

        console.error(
            "Create offer error:",
            error
        );
    }
}


/* =====================================================
   RECEIVE OFFER
===================================================== */

socket.on(
    "video-offer",
    async ({ sender, offer }) => {

        try {

            const peer = createPeer(sender);

            await peer.setRemoteDescription(
                new RTCSessionDescription(offer)
            );

            /*
               Add ICE candidates that arrived
               before the remote description.
            */

            await processPendingIceCandidates(sender);

            const answer = await peer.createAnswer();

            await peer.setLocalDescription(answer);

            socket.emit("video-answer", {
                target: sender,
                answer: answer
            });

        } catch (error) {

            console.error(
                "Answer error:",
                error
            );
        }
    }
);


/* =====================================================
   RECEIVE ANSWER
===================================================== */

socket.on(
    "video-answer",
    async ({ sender, answer }) => {

        const peer = peers[sender];

        if (!peer) {
            return;
        }

        try {

            await peer.setRemoteDescription(
                new RTCSessionDescription(answer)
            );

            await processPendingIceCandidates(sender);

        } catch (error) {

            console.error(
                "Remote description error:",
                error
            );
        }
    }
);


/* =====================================================
   ICE CANDIDATES
===================================================== */

socket.on(
    "ice-candidate",
    async ({ sender, candidate }) => {

        if (!candidate) {
            return;
        }

        const peer = peers[sender];

        if (!peer) {

            /*
               Peer does not exist yet.
               Store candidate until peer is created.
            */

            if (!pendingIceCandidates[sender]) {
                pendingIceCandidates[sender] = [];
            }

            pendingIceCandidates[sender].push(candidate);

            return;
        }

        /*
           Remote description has not arrived yet.
        */

        if (!peer.remoteDescription) {

            if (!pendingIceCandidates[sender]) {
                pendingIceCandidates[sender] = [];
            }

            pendingIceCandidates[sender].push(candidate);

            return;
        }

        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(candidate)
            );

        } catch (error) {

            console.error(
                "ICE error:",
                error
            );
        }
    }
);


/* =====================================================
   PROCESS PENDING ICE
===================================================== */

async function processPendingIceCandidates(target) {

    const peer = peers[target];

    if (!peer) {
        return;
    }

    const candidates =
        pendingIceCandidates[target];

    if (!candidates || !candidates.length) {
        return;
    }

    delete pendingIceCandidates[target];

    for (const candidate of candidates) {

        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(candidate)
            );

        } catch (error) {

            console.error(
                "Pending ICE error:",
                error
            );
        }
    }
}


/* =====================================================
   CREATE PEER
===================================================== */

function createPeer(target) {

    /*
       Reuse existing connection.
    */

    if (peers[target]) {
        return peers[target];
    }

    const peer = new RTCPeerConnection(
        configuration
    );

    peers[target] = peer;


    /* -----------------------------------------
       SEND OUR MEDIA
    ----------------------------------------- */

    if (localStream) {

        localStream
            .getTracks()
            .forEach((track) => {

                peer.addTrack(
                    track,
                    localStream
                );

            });
    }


    /* -----------------------------------------
       RECEIVE REMOTE MEDIA
    ----------------------------------------- */

    peer.ontrack = (event) => {

        const stream = event.streams[0];

        if (!stream) {
            return;
        }

        addRemoteVideo(
            target,
            stream,
            peerNames[target] || "Family Member"
        );
    };


    /* -----------------------------------------
       ICE
    ----------------------------------------- */

    peer.onicecandidate = (event) => {

        if (!event.candidate) {
            return;
        }

        socket.emit("ice-candidate", {
            target: target,
            candidate: event.candidate
        });
    };


    /* -----------------------------------------
       CONNECTION STATE
    ----------------------------------------- */

    peer.onconnectionstatechange = () => {

        console.log(
            target,
            "connection:",
            peer.connectionState
        );

        if (
            peer.connectionState === "failed" ||
            peer.connectionState === "closed"
        ) {

            removeVideo(target);
        }
    };


    return peer;
}


/* =====================================================
   ADD REMOTE VIDEO
===================================================== */

function addRemoteVideo(
    id,
    stream,
    name
) {

    /*
       Check if this user already has
       a video element.
    */

    const existing = document.getElementById(
        `video-${id}`
    );

    if (existing) {

        const existingVideo =
            existing.querySelector("video");

        if (
            existingVideo &&
            existingVideo.srcObject !== stream
        ) {

            existingVideo.srcObject = stream;

            existingVideo.play().catch(
                (error) => {

                    console.warn(
                        "Remote video play warning:",
                        error
                    );
                }
            );
        }

        return;
    }


    /*
       Container
    */

    const container =
        document.createElement("div");

    container.className =
        "video-container";

    container.id =
        `video-${id}`;


    /*
       Video
    */

    const video =
        document.createElement("video");

    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;

    video.srcObject = stream;


    video.play().catch(
        (error) => {

            console.warn(
                "Remote video play warning:",
                error
            );
        }
    );


    /*
       Name
    */

    const label =
        document.createElement("div");

    label.className =
        "video-name";

    label.textContent =
        name;


    container.appendChild(video);
    container.appendChild(label);

    videoGrid.appendChild(container);
}


/* =====================================================
   REMOVE VIDEO
===================================================== */

function removeVideo(id) {

    const element =
        document.getElementById(
            `video-${id}`
        );

    if (element) {
        element.remove();
    }


    if (peers[id]) {

        peers[id].close();

        delete peers[id];
    }


    delete peerNames[id];
    delete pendingIceCandidates[id];
}


/* =====================================================
   USER LEFT VIDEO
===================================================== */

socket.on(
    "video-user-left",
    (socketId) => {

        removeVideo(socketId);
    }
);


/* =====================================================
   MUTE MICROPHONE
===================================================== */

muteButton.addEventListener(
    "click",
    () => {

        if (!localStream) {
            return;
        }

        const audioTracks =
            localStream.getAudioTracks();

        if (!audioTracks.length) {
            return;
        }

        const track =
            audioTracks[0];

        track.enabled =
            !track.enabled;


        if (track.enabled) {

            muteButton.textContent =
                "🎤 Mute";

        } else {

            muteButton.textContent =
                "🔇 Unmute";
        }
    }
);


/* =====================================================
   CAMERA ON/OFF
===================================================== */

cameraButton.addEventListener(
    "click",
    () => {

        if (!localStream) {
            return;
        }

        const videoTracks =
            localStream.getVideoTracks();

        if (!videoTracks.length) {
            return;
        }

        const track =
            videoTracks[0];

        track.enabled =
            !track.enabled;


        if (track.enabled) {

            cameraButton.textContent =
                "📷 Camera Off";

        } else {

            cameraButton.textContent =
                "📷 Camera On";
        }
    }
);


/* =====================================================
   LEAVE VIDEO
===================================================== */

function leaveVideoChat() {

    /*
       Tell everyone we left.
    */

    socket.emit("leave-video");


    /*
       Close all peer connections.
    */

    Object.keys(peers).forEach((id) => {

        if (peers[id]) {
            peers[id].close();
        }

        delete peers[id];
    });


    /*
       Clear ICE queues.
    */

    Object.keys(
        pendingIceCandidates
    ).forEach((id) => {

        delete pendingIceCandidates[id];

    });


    /*
       Stop camera and microphone.
    */

    if (localStream) {

        localStream
            .getTracks()
            .forEach((track) => {

                track.stop();

            });

        localStream = null;
    }


    /*
       Remove all videos.
    */

    videoGrid.innerHTML = "";


    /*
       Reset buttons.
    */

    muteButton.textContent =
        "🎤 Mute";

    cameraButton.textContent =
        "📷 Camera Off";


    /*
       Hide video screen.
    */

    videoScreen.classList.add(
        "hidden"
    );


    /*
       Return to chat.
    */

    chatScreen.classList.remove(
        "hidden"
    );
}


/* =====================================================
   SOCKET DISCONNECT CLEANUP
===================================================== */

socket.on("disconnect", () => {

    Object.keys(peers).forEach((id) => {

        if (peers[id]) {
            peers[id].close();
        }

        delete peers[id];
    });

    Object.keys(
        pendingIceCandidates
    ).forEach((id) => {

        delete pendingIceCandidates[id];

    });
});

