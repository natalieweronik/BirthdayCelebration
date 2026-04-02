const params = new URLSearchParams(window.location.search);
const name = params.get("name") || "Friend";
let candleCount = parseInt(params.get("candles")) || 4;
candleCount = Math.min(Math.max(candleCount, 1), 10);

const birthdayMessage = document.getElementById("birthdayText");
birthdayMessage.innerHTML =
    `<div id="mainTitle">Happy Birthday, ${name}!</div>
    <div id="subTitle">Blow out your candles and make a wish!</div>`;
const cake = document.getElementById("cake");

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
const candleXOffset = 32;

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

createCandles(candleCount);

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

        const source = audioContext.createMediaStream(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 1024; // more bins gives smoother detection
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount); //stores audio (8 bit unsigned)
        const timeArray = new Uint8Array(analyser.fftSize);

        let blown = false;
        let blowFrames = 0;
        let cooldownFrames = 0;

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

            // Use both spectral shape and overall intensity so blowing works more consistently.
            const blowRatioThreshold = 0.34;
            const blowVolumeThreshold = 12;
            const blowRmsThreshold = 0.03;
            const looksLikeBlow =
                (ratio > blowRatioThreshold && highAvg > 4) ||
                volume > blowVolumeThreshold ||
                rms > blowRmsThreshold;

            if (looksLikeBlow) {
                blowFrames += 1;
                cooldownFrames = 0;
            } else {
                cooldownFrames += 1;
                if (cooldownFrames > 2) {
                    blowFrames = 0;
                }
            }

            if(blowFrames >= 2 && !blown){
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
        const subTitle = document.getElementById("subTitle");
        subTitle.textContent = `Yippee!! Hope you have the happiest birthday! <3`
    }, 1200);
};

const btn = document.getElementById('micBtn');
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