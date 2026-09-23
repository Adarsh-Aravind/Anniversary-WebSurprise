# Anniversary Memory Game

A beautifully designed, interactive memory matching game created as a first-year relationship anniversary gift. The game challenges players to find matching pairs of special memory photos, featuring a polished UI with dynamic floating heart animations and engaging gameplay mechanics.

## Features

- **Interactive Gameplay**: Classic memory matching game structure with 3D card flip animations.
- **Dynamic Background**: Features floating, animated hearts to create a romantic and celebratory atmosphere.
- **Victory State**: Triggers a congratulatory message upon successfully finding all matching memories.
- **Clean UI/UX**: Built with a responsive, modern glassmorphism-inspired container and smooth transitions.

## Technology Stack

- **HTML5**: Semantic game structure and layout.
- **CSS3**: Styling, 3D card flipping effects (`transform-style: preserve-3d`), and keyframe animations for the floating elements (`@keyframes`).
- **JavaScript (Vanilla)**: Game logic, state management, array shuffling, and DOM manipulation.

## Setup Instructions

1. Clone or download the repository to your local machine.
2. Ensure you have an `Images` directory in the root folder.
3. Add 6 images named `image1.jpg` through `image6.jpg` into the `Images` directory. These will be the memories you match during the game.
4. Open the `index.html` file in any modern web browser to play.

## Gameplay Overview

1. The game initializes with a grid of 12 facedown cards (6 pairs).
2. Click on any card to reveal the memory hidden behind it.
3. Click a second card to attempt to find its match.
4. If the two cards match, they remain face up and disabled.
5. If they do not match, they flip back over after a brief delay.
6. The game concludes when all memory pairs have been successfully matched.
