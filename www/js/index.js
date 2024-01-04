function onDeviceReady() {
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);

    GeminiX.init(function(){
        console.log('GeminiX init success');
    }, function(error){
        console.error('GeminiX init error: ' + error);
    });
}

document.addEventListener('deviceready', onDeviceReady, false);
