// Get the game board element from the HTML
const gameBoard = document.querySelector('.memory-game');
const floatingElementsContainer = document.querySelector('.floating-elements');

// The photos are the encrypted ones from Year 3 (../year3/sealed.json), unlocked
// with the same passcode. These are our year-two photos, in order of preference.
const PREFERRED_PHOTOS = ['scene1.webp', 'scene2.jpg', 'scene3.jpg', 'scene4.jpg', 'scene5.jpg', 'story3.jpg'];
const PAIRS = 6;

// Filled in after unlocking: photo name -> object URL
let photoUrls = {};
let imageNames = [];
let cardImages = [];

// --- GAME STATE VARIABLES ---
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchedPairs = 0;
let totalPairs = 0;

// --- FUNCTIONS ---

// Function to shuffle the card images randomly (Fisher-Yates)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- UNLOCKING THE PHOTOS (same PBKDF2 -> AES-GCM as year3/app.js) ---
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function unlockPhotos(passcode) {
    const sealed = await fetch('../year3/sealed.json', { cache: 'no-cache' }).then((r) => r.json());
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode.trim().toLowerCase()), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: fromB64(sealed.salt), iterations: sealed.iter, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.data));
    const photos = JSON.parse(new TextDecoder().decode(plain)).photos || {};

    const available = Object.keys(photos);
    const names = PREFERRED_PHOTOS.filter((n) => photos[n]);
    for (const n of available) if (names.length < PAIRS && !names.includes(n)) names.push(n);

    const urls = {};
    await Promise.all(names.map(async (name) => {
        const buf = await fetch(`../year3/${photos[name].src}`).then((r) => r.arrayBuffer());
        const img = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(buf, 0, 12) }, key, new Uint8Array(buf, 12));
        urls[name] = URL.createObjectURL(new Blob([img], { type: photos[name].type }));
    }));
    return urls;
}

// Function to create the HTML for each card and add it to the board
function createBoard() {
    shuffle(cardImages);

    cardImages.forEach(imageName => {
        const card = document.createElement('div');
        card.classList.add('memory-card');
        card.dataset.name = imageName;

        card.innerHTML = `
            <img class="front-face" src="${photoUrls[imageName]}" alt="">
            <div class="back-face">?</div>
        `;

        gameBoard.appendChild(card);
        card.addEventListener('click', flipCard);
    });
}

// The main function for flipping a card
function flipCard() {
    if (lockBoard) return;
    if (this === firstCard) return;

    this.classList.add('flip');

    if (!hasFlippedCard) {
        hasFlippedCard = true;
        firstCard = this;
        return;
    }

    secondCard = this;
    checkForMatch();
}

// Function to check if the two flipped cards match
function checkForMatch() {
    let isMatch = firstCard.dataset.name === secondCard.dataset.name;

    if (isMatch) {
        disableCards();
        matchedPairs++;
        if (matchedPairs === totalPairs) {
            setTimeout(() => {
                alert("Congratulations! You've found all our memories! Happy Anniversary! ❤️");
            }, 500);
        }
    } else {
        unflipCards();
    }
}

// Function to handle a successful match
function disableCards() {
    firstCard.removeEventListener('click', flipCard);
    secondCard.removeEventListener('click', flipCard);

    resetBoard();
}

// Function to handle a failed match
function unflipCards() {
    lockBoard = true;

    setTimeout(() => {
        firstCard.classList.remove('flip');
        secondCard.classList.remove('flip');
        resetBoard();
    }, 1500);
}

// Function to reset the game state variables after each turn
function resetBoard() {
    [hasFlippedCard, lockBoard] = [false, false];
    [firstCard, secondCard] = [null, null];
}

// Function to create and position floating love elements
function createFloatingLoveElements(count) {
    for (let i = 0; i < count; i++) {
        const loveElement = document.createElement('div');
        loveElement.classList.add('floating-love', 'heart');

        const size = Math.random() * 40 + 40;
        loveElement.style.width = `${size}px`;
        loveElement.style.height = `${size}px`;

        loveElement.style.left = `${Math.random() * 100}vw`;
        loveElement.style.top = `${100 + Math.random() * 20}vh`;

        loveElement.style.animationDuration = `${Math.random() * 10 + 10}s`;
        loveElement.style.animationDelay = `${Math.random() * 5}s`;

        floatingElementsContainer.appendChild(loveElement);

        loveElement.addEventListener('animationend', () => {
            loveElement.remove();
            createFloatingLoveElements(1);
        });
    }
}

// --- START THE GAME ---
const unlockForm = document.querySelector('#unlock');
const passInput = document.querySelector('#pass');
const errorText = document.querySelector('#error');
const startButton = unlockForm.querySelector('button');

fetch('../year3/sealed.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((s) => { if (s.hint) document.querySelector('#hint').textContent = `Hint: ${s.hint}`; })
    .catch(() => {});

unlockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!passInput.value.trim()) return;
    startButton.disabled = true;
    startButton.textContent = 'Loading…';
    errorText.textContent = '';
    try {
        photoUrls = await unlockPhotos(passInput.value);
        imageNames = Object.keys(photoUrls);
        cardImages = [...imageNames, ...imageNames];
        totalPairs = imageNames.length;
        unlockForm.remove();
        gameBoard.hidden = false;
        createBoard();
    } catch {
        errorText.textContent = "That's not it. Try again.";
        startButton.disabled = false;
        startButton.textContent = 'Start';
        passInput.select();
    }
});

createFloatingLoveElements(15);


