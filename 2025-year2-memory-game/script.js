// Get the game board element from the HTML
const gameBoard = document.querySelector('.memory-game');
const floatingElementsContainer = document.querySelector('.floating-elements');

// An array holding the names of your images
// Make sure these names match the files in your 'images' folder!
const imageNames = ['image1', 'image2', 'image3', 'image4', 'image5', 'image6'];

// We need two of each card for a match
const cardImages = [...imageNames, ...imageNames];

// --- GAME STATE VARIABLES ---
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchedPairs = 0;
const totalPairs = imageNames.length;

// --- FUNCTIONS ---

// Function to shuffle the card images randomly
function shuffle(array) {
    array.sort(() => Math.random() - 0.5);
}

// Function to create the HTML for each card and add it to the board
function createBoard() {
    shuffle(cardImages);

    cardImages.forEach(imageName => {
        const card = document.createElement('div');
        card.classList.add('memory-card');
        card.dataset.name = imageName;

        card.innerHTML = `
            <img class="front-face" src="Images/${imageName}.jpg" alt="${imageName}">
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
createBoard();
createFloatingLoveElements(15);


