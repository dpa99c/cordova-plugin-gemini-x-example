var $conversationOutput, modelName = "", loaderTimerId;
var chatHistory = [];
var streamResponse = false;
var images = [];
var savedState = {};

function onDeviceReady() {
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    $conversationOutput = $('#conversation-output');

    $('#stream-response').on('click', toggleStreamResponse);
    loadState();
}

function initModel(){
    modelName = $('#model').val();

    var safetySettings = {};
    safetySettings[GeminiX.SafetySettingHarmCategory.DANGEROUS_CONTENT] = GeminiX.SafetySettingLevel.LOW_AND_ABOVE;

    var params = {
        modelName: modelName,
        apiKey: GEMINI_API_KEY,
        temperature: 0.9,
        topP: 0.1,
        topK: 16,
        maxOutputTokens: 2000,
        stopSequences: ["red"],
        safetySettings: safetySettings
    };

    GeminiX.initModel(function(){
        prependToConversation(`${modelName}: initialised`);
        savedState["model"] = params;
    }, function(error){
        prependToConversation(`${modelName} init error: ${error}`);
    }, params);
}

function sendMessage(){
    var text = $('#text-input').val();
    if(!text){
        prependToConversation('Please enter a message', 'error');
        return;
    }

    prependToConversation(`You: ${text}`);

    showLoader();
    var messageId;
    if(streamResponse){
        messageId = prependToConversation(`${modelName} response: `, 'stream');
    }
    GeminiX.sendMessage(function(responseText, isFinal){
        hideLoader();
        clearMessage();
        clearImages();
        if(streamResponse){
            appendToMessage(messageId, responseText);
            if(isFinal){
                $('#' + messageId).removeClass('stream');
            }
        }else{
            prependToConversation(`${modelName} response: ` + responseText);
        }
    }, function(error){
        hideLoader();
        prependToConversation(`${modelName} error: ${error}`, 'error');
    }, text, {
        streamResponse: streamResponse,
        images: images
    });
}

function countTokens(){
    var text = $('#text-input').val();
    if(!text){
        prependToConversation('Please enter a message', 'error');
        return;
    }

    showLoader();
    GeminiX.countTokens(function(count){
        hideLoader();
        prependToConversation(`${modelName} token count: ${count}`);
    }, function(error){
        hideLoader();
        prependToConversation(`${modelName} token count error: ${error}`, 'error');
    }, text, {
        images: images
    });
}

function initChat(){
    var message = 'chat initialised';
    if(chatHistory.length > 0){
        message = ' with history of ' + chatHistory.length + ' messages';
    }
    
    var initChatHistory = [];
    for(var i = 0; i < chatHistory.length; i++){
        var chatMessage = chatHistory[i];
        var parts = chatMessage.parts;
        var initChatMessage = {
            isUser: chatMessage.isUser,
            parts: []
        };
        for(var j = 0; j < parts.length; j++){
            var part = parts[j];
            if(part.type === 'text'){
                initChatMessage.parts.push({
                    type: "text",
                    content: part.content
                });
            }else if(part.type === 'image'){
                initChatMessage.parts.push({
                    type: "image",
                    content: part.content
                });
            }else{
                prependToConversation('init chat history: part with type "'+part.type+"' cannot be used for initialisation")
            }
        }
        initChatHistory.push(initChatMessage);
    }
    
    GeminiX.initChat(function(){
        prependToConversation(`${modelName}: ` + message);
    }, function(error){
        prependToConversation(`${modelName} error initialising chat: ${error}`, 'error');
    }, initChatHistory);
}

function addHistory(isUser){
    var parts = [];

    var text = $('#text-input').val();
    if(text){
        parts.push({
            type: "text",
            content: text
        });
    }

    if(isUser){
        images.forEach(function(image){
            parts.push({
                type: "image",
                content: image.uri
            })
        });
    }

    if(parts.length === 0){
        prependToConversation('Please enter a message or attach an image to add to history', 'error');
        return;
    }

    chatHistory.push({
        isUser: isUser,
        parts: parts
    });
    savedState["chatHistory"] = chatHistory;
    saveState();

    var message = `Added to ${isUser ? 'user' : 'model'} chat history with text "${text}"`;
    if(images.length > 0) message += ` and ${images.length} image(s)`;
    prependToConversation(message);
    clearMessage();
    clearImages();
}

function clearHistory(){
    chatHistory = [];
    savedState["chatHistory"] = chatHistory;
    saveState();
    prependToConversation('Cleared chat history');
}

function sendChatMessage(){
    var text = $('#text-input').val();
    if(!text){
        prependToConversation('Please enter a message', 'error');
        return;
    }

    prependToConversation(`You: ${text}`);

    showLoader();
    var messageId, entireStreamedResponse = '';
    if(streamResponse){
        messageId = prependToConversation(`${modelName} chat response: `, 'stream');
    }


    GeminiX.sendChatMessage(function(responseText, isFinal){
        hideLoader();
        clearMessage();
        clearImages();

        if(streamResponse){
            appendToMessage(messageId, responseText);
            entireStreamedResponse += responseText;
            if(isFinal){
                $('#' + messageId).removeClass('stream');
                afterChatResponse(text, entireStreamedResponse);
            }
        }else{
            prependToConversation(`${modelName} chat response: ` + responseText);
            afterChatResponse(text, responseText);
        }


    }, function(error){
        hideLoader();
        prependToConversation(`${modelName} chat error: ${error}`, 'error');
    }, text, {
        streamResponse: streamResponse,
        images: images
    });
}

function afterChatResponse(inputText, responseText){
    chatHistory.push({
        isUser: true,
        parts: [{
            type: "text",
            content: inputText
        }]
    });

    chatHistory.push({
        isUser: false,
        parts: [{
            type: "text",
            content: responseText
        }]
    });

    savedState["chatHistory"] = chatHistory;
    saveState();
}

function countChatTokens(){
    var text = $('#text-input').val();
    var options = {};
    if(text){
        options["text"] = text;
    }if(images.length > 0){
        options["images"] = images;
    }

    showLoader();
    GeminiX.countChatTokens(function(count){
        hideLoader();
        prependToConversation(`${modelName} chat token count: ${count}`);
    }, function(error){
        hideLoader();
        prependToConversation(`${modelName} chat token count error: ${error}`, 'error');
    }, options);
}

function getChatHistory(){
    GeminiX.getChatHistory(function(thisChatHistory){
        chatHistory = thisChatHistory;
        savedState["chatHistory"] = chatHistory;
        saveState();
        displayChatHistory(chatHistory);
        if(chatHistory.length === 0){
            prependToConversation(`${modelName} chat history is empty`);
        }else{
            prependToConversation(`${modelName} chat history of ${chatHistory.length} messages retrieved`);
        }
    }, function(error){
        prependToConversation(`${modelName} chat history error: ${error}`, 'error');
    });
}

function onPressClear(){
    clearMessage();
    clearImages();
    clearHistory();
    clearState();
}

function clearMessage(){
    $('#text-input').val('');
}

function clearImages(){
    images = [];
    updateImagesUI();
}

function prependToConversation(message, className){
    message = message.replace(/\n/g, "<br/>");
    var guid = generateUID();
    $conversationOutput.prepend('<span id="'+guid+'" class="'+(className || '')+'">&gt;&nbsp;<span class="message">' +message + '</span></span>' + "<br/><br/>" );
    console.log(message);
    return guid;
}

function generateUID() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function appendToMessage(guid, message){
    var $el = $('#' + guid + ' .message');
    $el.html($el.html() + message);
}

function clearConversation(){
    $conversationOutput.empty();
}

function toggleStreamResponse(e){
    streamResponse = e.target.checked;
}

function showLoader(){
    $('#loader').show();
    loaderTimerId = setTimeout(onLoaderTimeout, 30000);
}

function hideLoader(){
    $('#loader').hide();
    clearTimeout(loaderTimerId);
}

function onLoaderTimeout(){
    hideLoader();
    prependToConversation(`${modelName} response timed out`, 'error');
}

function openImagePicker(){
    window.AdvancedImagePicker.present({
        // config here
    }, function(mediaEntries) {
        for(var i = 0; i < mediaEntries.length; i++){
            var mediaEntry = mediaEntries[i];
            if(mediaEntry.type === 'image'){
                images.push({uri: mediaEntry.src});
            }else{
                prependToConversation(`error picking image(s): unsupported media type ${mediaEntry.type} for ${mediaEntry.src}`, 'error');
            }
        }
        updateImagesUI();
    }, function (error) {
        prependToConversation(`error picking image(s): ${error}`, 'error');
    });
}

function updateImagesUI(){
    var $images = $('#images');
    $images.empty();
    for(var i = 0; i < images.length; i++){
        var imageUri = images[i].uri,
            imageId = imageUri.split('/').pop();
        if(imageId.match('-')){
            imageId = imageUri.split('-').pop();
        }

        $images.append('<span class="image" onclick="removeImage(\''+imageUri+'\')">IMAGE: '+imageId+'</span>');
    }
}

function removeImage(imageUri){
    for(var i = 0; i < images.length; i++){
        var image = images[i];
        if(image.uri === imageUri){
            images.splice(i, 1);
            updateImagesUI();
            return;
        }
    }
}

function saveState(){
    window.localStorage.setItem('state', JSON.stringify(savedState));
}

function loadState(){
    var state = window.localStorage.getItem('state');
    if(state){
        savedState = JSON.parse(state);


        if(savedState["model"]){
            $('#model').val(savedState["model"].modelName);
            initModel();
        }

        if(savedState["chatHistory"]){
            // Restore chat history
            chatHistory = savedState["chatHistory"];
            displayChatHistory(chatHistory);
        }

        if(savedState["model"] && savedState["chatHistory"]){
            initChat();
        }
    }
}

function displayChatHistory(thisChatHistory){
    for(var i = 0; i < thisChatHistory.length; i++){
        var chatMessage = thisChatHistory[i];
        var parts = chatMessage.parts;
        for(var j = 0; j < parts.length; j++){
            var part = parts[j];
            if(part.type === 'text'){
                prependToConversation(`${chatMessage.isUser ? 'You' : modelName + ' chat history'}: ${part.content}`);
            }else{
                prependToConversation(`You: IMAGE: ${part.type}`);
            }
        }
    }
    updateImagesUI();
}

function clearState(){
    savedState = {};
    saveState();
}

document.addEventListener('deviceready', onDeviceReady, false);
