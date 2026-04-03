const params = new URLSearchParams(window.location.search);
const nameFromUrl = params.get("name");
const name = nameFromUrl || "Friend";

const cake = document.getElementById("cake");
const btn = document.getElementById("micBtn");
const dialog = document.getElementById("userName");
const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("name");
const selectedCake = document.getElementById("selectedCake");
const candlesSelect = document.getElementById("candles");
const birthdayMessage = document.getElementById("birthdayText");
const cakeChoiceButtons = document.querySelectorAll(".cakeChoice");
let candleCount = parseInt(document.getElementById("candles")?.value, 10) || 4;
candleCount = Math.min(Math.max(candleCount, 1), 30);

window.addEventListener('load', () => {
    const bgm = document.getElementById('bgm');

    if (bgm.paused) {
        const play = document.getElementById('play');

        play.onclick = () => {
            if (play.dataset.transitioning === "true") {
                return;
            }

            play.dataset.transitioning = "true";
            bgm.play();
            play.classList.add("fade-out");

            const onFadeOutEnd = (event) => {
                if (event.propertyName !== "opacity") {
                    return;
                }

                play.removeEventListener("transitionend", onFadeOutEnd);
                play.innerHTML = `&#127874;Now Playing: K.K. Birthday`;
                play.classList.remove("fade-out");
                play.onclick = null;
                play.dataset.transitioning = "false";
            };

            play.addEventListener("transitionend", onFadeOutEnd);
        };

        play.classList.add("show");
    }
});

function renderGreeting(displayName) {
    birthdayMessage.innerHTML =
        `<div id="mainTitle">Happy Birthday, ${displayName}!</div>
        <div id="subTitle">Blow out your candles and make a wish!</div>`;
}

renderGreeting(name);

if (dialog) {
    dialog.showModal();
}

if (nameForm) {
    nameForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const enteredName = nameInput.value.trim() || "Friend";
        renderGreeting(enteredName);

        candleCount = parseInt(candlesSelect?.value, 10) || 4;
        candleCount = Math.min(Math.max(candleCount, 1), 30);
        createCandles(candleCount);
        applyCake();

        if (dialog) {
            dialog.close();
        }
    });
}

function getSelectedCake(){
    return selectedCake ? selectedCake.value : "vanilla";
}

function applyCake() {
    const style = getSelectedCake();
    cake.className = `cake ${style}`;
}

if (selectedCake) {
    selectedCake.addEventListener("change", applyCake);
}

cakeChoiceButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const cakeType = button.dataset.cake || "vanilla";
        if (selectedCake) {
            selectedCake.value = cakeType;
        }
        applyCake();
    });
});

const candleColors = [
    "pink-candle-idle",
    "orange-candle-idle",
    "yellow-candle-idle",
    "green-candle-idle",
    "blue-candle-idle",
    "purple-candle-idle"
];

const cake_visual_width = 35;
const candle_visual_width = 2;
const candlesPerRow = 10;
const shiftAmount = 10;
const pixelUnit = 5;
const candleScale = 0.55;
const candleXOffset = 40;

applyCake();
createCandles(candleCount);

function createCandles(count) {
    cake.innerHTML = "";

    for (let i = 0; i < count; i++) {
        const candle = document.createElement("div");
        candle.classList.add("candle");
        const colorClass = candleColors[Math.floor(Math.random() * candleColors.length)];
        candle.classList.add(colorClass);

        const row = Math.floor(i / candlesPerRow);
        const col = i % candlesPerRow;

        const candlesInThisRow = Math.min(candlesPerRow, count - row * candlesPerRow);

        const rowSpace = (cake_visual_width * pixelUnit) / (candlesInThisRow + 1);
        const leftBase = (rowSpace * (col + 1)) - ((candle_visual_width * pixelUnit) / 2);
        const rowShift = (row % 2 === 0) ? 0 : shiftAmount;

        candle.style.position = "absolute";
        candle.style.top = `${-8 + row * 18}px`;
        candle.style.left = `${leftBase - rowShift + candleXOffset}px`;
        candle.style.transform = `scale(${candleScale})`;
        candle.style.transformOrigin = "top left";

        cake.appendChild(candle);
    }
}

let micFallbackEnabled = false;

function enableManualFallback(message) {
    micFallbackEnabled = true;
    const subTitle = document.getElementById("subTitle");
    if (subTitle && message) {
        subTitle.textContent = message;
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = "Tap to blow manually";
    }
}

async function startMicDetection(){
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            enableManualFallback("Microphone is unavailable in this browser. Tap to blow manually.");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 1024; // more bins gives smoother detection
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount); //stores audio (8 bit unsigned)
        const timeArray = new Uint8Array(analyser.fftSize);

        let blown = false;
        let blowFrames = 0;
        let cooldownFrames = 0;
        let previousRms = 0;
        const detectionStartTime = performance.now();
        const gracePeriodMs = 650;
        const listeningWindowMs = 10000;
        const requiredBlowFrames = 6;  // Requires more sustained detection
        const subTitle = document.getElementById("subTitle");

        function detectBlow(){
            analyser.getByteFrequencyData(dataArray);
            analyser.getByteTimeDomainData(timeArray);

            let highFreqSum = 0;
            let lowFreqSum = 0; 

            const midpoint = dataArray.length/2;

            for (let i = 0; i < dataArray.length; i++){
                if (i < midpoint){
                    lowFreqSum+=dataArray[i];
                } else {
                    highFreqSum+=dataArray[i];
                }
            }

            const highAvg = highFreqSum/midpoint;
            const lowAvg = lowFreqSum/midpoint;

            const ratio = highAvg / (lowAvg + 1);
            const volume = (highFreqSum + lowFreqSum) / dataArray.length;

            let squareSum = 0;
            for (let i = 0; i < timeArray.length; i++) {
                const centered = (timeArray[i] - 128) / 128;
                squareSum += centered * centered;
            }
            const rms = Math.sqrt(squareSum / timeArray.length);

            // Detect sudden increase in energy (attack/onset) - filters out steady background noise
            const rmsIncrease = rms - previousRms;
            const hasOnset = rmsIncrease > 0.015;  // Sudden spike in energy
            previousRms = rms * 0.7 + previousRms * 0.3;  // Smooth previous for stable comparison

            // Stricter thresholds to filter background noise and chatter
            const blowRatioThreshold = 0.55;     // More strict ratio
            const blowVolumeThreshold = 8.0;     // Higher volume threshold
            const blowRmsThreshold = 0.065;      // Higher RMS threshold
            const ratioTriggered = ratio > blowRatioThreshold && highAvg > 8;
            const volumeTriggered = volume > blowVolumeThreshold;
            const rmsTriggered = rms > blowRmsThreshold;
            
            // Require onset + at least 2 other signals = real blow pattern
            const triggeredSignals =
                Number(ratioTriggered) + Number(volumeTriggered) + Number(rmsTriggered);
            const looksLikeBlow = hasOnset && triggeredSignals >= 2;

            const elapsedMs = performance.now() - detectionStartTime;

            // Ignore very early room noise right after mic starts.
            if (elapsedMs < gracePeriodMs) {
                if (subTitle) {
                    subTitle.textContent = "Listening... get ready to blow";
                }
                requestAnimationFrame(detectBlow);
                return;
            }

            // Keep listening for longer, but do not delay detection during this window.
            if (elapsedMs > gracePeriodMs + listeningWindowMs) {
                stream.getTracks().forEach((track) => track.stop());
                enableManualFallback("Didn't catch a blow in time. Tap to blow manually.");
                return;
            }

            if (looksLikeBlow) {
                blowFrames += 1;
                cooldownFrames = 0;
                if (subTitle) {
                    subTitle.textContent = `Blow detected!`;
                }
            } else {
                cooldownFrames += 1;
                if (cooldownFrames > 2) {  // Faster reset - if signal drops for 2 frames, reset
                    blowFrames = 0;
                }
                if (subTitle) {
                    subTitle.textContent = "Listening... blow now!";
                }
            }

            if(blowFrames >= requiredBlowFrames && !blown){
                blown = true;
                blowOutCandles();

                stream.getTracks().forEach((track) => track.stop());
                if (btn) {
                    btn.textContent = "Candles blown!";
                }
                return;
            }

            requestAnimationFrame(detectBlow);
        }

        detectBlow(); 
    } catch (err) {
        console.error("Microphone access error: ", err);

        let fallbackMessage = "Microphone was blocked. Allow mic access in browser site settings, then refresh. For now, tap to blow manually.";
        if (err && err.name === "NotFoundError") {
            fallbackMessage = "No microphone was found. Connect a mic, then refresh. For now, tap to blow manually.";
        } else if (err && err.name === "NotReadableError") {
            fallbackMessage = "Microphone is in use by another app. Close that app and refresh. For now, tap to blow manually.";
        } else if (err && err.name === "SecurityError") {
            fallbackMessage = "Microphone access is blocked by browser security settings. For now, tap to blow manually.";
        }

        enableManualFallback(fallbackMessage);
    }
}

const blownCandleColors = [
    "pink-candle",
    "orange-candle",
    "yellow-candle",
    "green-candle",
    "blue-candle",
    "purple-candle"
];

function blowOutCandles(){
    const candles = document.querySelectorAll(".candle");
    candles.forEach((candle) => {
        const idleClass = candleColors.find(cls => candle.classList.contains(cls));
        if (idleClass) {
            const index = candleColors.indexOf(idleClass);
            const blownClass = blownCandleColors[index];

            candle.classList.remove(idleClass);
            candle.classList.add(blownClass);
        }
        candle.classList.add("blown");
    });

    setTimeout(() => {
        candles.forEach((candle) => {
            candle.classList.remove("blown");
            candle.classList.add("extinguished");
        });
    }, 1000);

    setTimeout(() => {
        confetti({
            particleCount:300,
            spread: 100,
            startVelocity: 55, 
            scalar: 0.9
        });
        const subTitle = document.getElementById("subTitle");
        subTitle.textContent = 'Yay! Hope u have the best birthday!♡‧₊˚';
    }, 1200);
};

if (btn) {
   btn.addEventListener('click', () => {
        if (micFallbackEnabled) {
            btn.disabled = true;
            btn.textContent = "Candles blown!";
            blowOutCandles();
            return;
        }

        //disable the button so the user can’t click twice
       btn.disabled = true;
       btn.textContent = 'Listening... blow now!';

        //request mic permission
        startMicDetection();
    });
}