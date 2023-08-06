const ENDPOINT = 'https://tiktok-tts.weilnet.workers.dev';

const TEXT_CHAR_LIMIT = 287;
const CHUNK_CHAR_LIMIT = 32232;

const textEncoder = new TextEncoder();

window.onload = () => {
    document.getElementById('charcount').textContent = `0/${TEXT_CHAR_LIMIT}`;

    const req = new XMLHttpRequest();
    req.open('GET', `${ENDPOINT}/api/status`, false);
    req.send();

    let resp = JSON.parse(req.responseText);
    if (resp.data) {
        if (resp.data.available) {
            console.info(`${resp.data.meta.dc} (age ${resp.data.meta.age} minutes) is able to provide service`);
            enableControls();
        } else {
            console.error(`${resp.data.meta.dc} (age ${resp.data.meta.age} minutes) is unable to provide service`);
            setError(
                `Service not available${resp.data.message && resp.data.message.length > 1 ? ` (<b>"${resp.data.message}"</b>)` : ''}, try again later or check the <a href='https://github.com/Weilbyte/tiktok-tts'>GitHub</a> repository for more info`
            );
        }
    } else {
        setError('Error querying API status, try again later or check the <a href=\'https://github.com/Weilbyte/tiktok-tts\'>GitHub</a> repository for more info');
    }  
};

const setError = (message) => {
    clearAudio();
    document.getElementById('error').style.display = 'block';
    document.getElementById('errortext').innerHTML = message;
};

const clearError = () => {
    document.getElementById('error').style.display = 'none';
    document.getElementById('errortext').innerHTML = 'There was an error.';
};

const setAudio = (base64, text) => {
    // Check if the base64 audio is too long for data URI
	console.log("setAudio() base64 length:" + base64.length);
    /*if (base64.length > CHUNK_CHAR_LIMIT) {
				console.log("setAudio() if length");
        setError("Audio is too long. Please try a shorter text.");
        return;
    }*/
		console.log("setAudio() pre if 0");
    document.getElementById('success').style.display = 'block';
		console.log("setAudio() pre if 1");
    // Check if the base64 audio is within URL length limit
    if (base64.length <= 20000) {
		console.log("setAudio() if");
        // Use data URI for short audio files
        document.getElementById('audio').src = `data:audio/mpeg;base64,${base64}`;
    } else {
		console.log("setAudio() else");
        // Use Blob URL for long audio files
        const blob = b64toBlob(base64, 'audio/mpeg');
        const blobUrl = URL.createObjectURL(blob);
        document.getElementById('audio').src = blobUrl;
    }
    document.getElementById('generatedtext').innerHTML = `"${text}"`;
};

const clearAudio = () => {
    document.getElementById('success').style.display = 'none';
    document.getElementById('audio').src = ``;
    document.getElementById('generatedtext').innerHTML = '';
};

const disableControls = () => {
    document.getElementById('text').setAttribute('disabled', '');
    document.getElementById('voice').setAttribute('disabled', '');
    document.getElementById('submit').setAttribute('disabled', '');
};

const enableControls = () => {
    document.getElementById('text').removeAttribute('disabled');
    document.getElementById('voice').removeAttribute('disabled');
    document.getElementById('submit').removeAttribute('disabled');
};

const onTextareaInput = () => {
    const text = document.getElementById('text').value;
    const textLength = textEncoder.encode(text).length;

    document.getElementById('charcount').textContent = `${textLength <= 999 ? textLength : 999}/${TEXT_CHAR_LIMIT}`;

    if (textLength > TEXT_CHAR_LIMIT) {
        document.getElementById('charcount').style.color = 'red';
    } else {
        document.getElementById('charcount').style.color = 'black';
    }
};

// Function to convert base64 to Blob
const b64toBlob = (b64Data, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
};

const submitForm = () => {
    clearError();
    clearAudio();

    disableControls();

    let text = document.getElementById('text').value;
    // Remove excessive line breaks from the text
    text = text.replace(/[\r\n]{3,}/g, '\n\n');
    // Replace smart quotes with regular quotes
    text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

    // Split the text into words
    const words = text.split(' ');

    // Create an array to store the chunks of text
    const textChunks = [];
    let currentChunk = '';

    for (const word of words) {
        // Check if adding the current word will exceed the byte limit
        const nextChunk = `${currentChunk}${currentChunk ? ' ' : ''}${word}`;
        const nextChunkLength = new TextEncoder().encode(nextChunk).length;

        if (nextChunkLength <= TEXT_CHAR_LIMIT) {
            // Add the word to the current chunk if it doesn't exceed the limit
            currentChunk = nextChunk;
        } else {
            // Add the current chunk to the list and start a new chunk with the current word
            textChunks.push(currentChunk);
            currentChunk = word;
        }
    }

    // Add the last chunk to the list
    if (currentChunk) {
        textChunks.push(currentChunk);
    }

    const textLength = new TextEncoder().encode(text).length;
    console.log(textLength);

    if (textLength === 0) text = 'The fungus among us.'; 
    const voice = document.getElementById('voice').value;

    if (voice == "none") {
        setError("No voice has been selected");
        enableControls();
        return;
    }

    if (textLength > TEXT_CHAR_LIMIT) {
        processLongText(text, voice);
    } else {
        generateAudio(text, voice);
    }
};

const processLongText = (text, voice) => {
    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
        const chunk = text.slice(currentIndex, currentIndex + CHUNK_CHAR_LIMIT);
        chunks.push(chunk);
        currentIndex += CHUNK_CHAR_LIMIT;
    }

    const audioData = [];

    const processNextChunk = (index) => {
        if (index >= chunks.length) {
            const mergedAudio = audioData.join('');
            setAudio(mergedAudio, text);
            enableControls();
            return;
        }

        generateAudio(chunks[index], voice, (base64Audio) => {
            audioData.push(base64Audio);
            processNextChunk(index + 1);
        });
    };

    processNextChunk(0);
};

const generateAudio = (text, voice, callback = null) => {
    console.log("generateAudio() begin try");
	try {
        const req = new XMLHttpRequest();
		console.log("running generateAudio()");
        req.open('POST', `${ENDPOINT}/api/generation`, false);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify({
            text: text,
            voice: voice
        }));

        let resp = JSON.parse(req.responseText);
		console.log("generateAudio() resp:" + resp.data);
        if (resp.data === null) {
            setError(`<b>Generation failed</b><br/> ("${resp.error}")`);
        } else {
			console.log("generateAudio() pre if");
            if (callback) {
				console.log("generateAudio() if ");
                callback(resp.data);
            } else {
				console.log("generateAudio() else text=" + text);
                setAudio(resp.data, text);
            }
        }  
    } catch {
        setError('Error submitting form (printed to F12 console)');
        console.log('^ Please take a screenshot of this and create an issue on the GitHub repository if one does not already exist :)');
        console.log('If the error code is 503, the service is currently unavailable. Please try again later.');
        console.log(`Voice: ${voice}`);
        console.log(`Text: ${text}`);
    }
};
