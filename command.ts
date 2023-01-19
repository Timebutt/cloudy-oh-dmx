'use strict';

const Dgram = require('dgram');
const util = require('util');

const client = Dgram.createSocket('udp4');
client.on('message', function (msg, info) {
    const JSonObj = msg.toString('utf8');

    console.log(JSonObj);
    console.log(info);
});

const PORT = 38899;

var adress = null;
var success = false;
var state = false;
var mac = null;
var dimming = 50;
var temp = 2700;
var sceneId = 0;
var speed = 0;
var red = 255;
var green = 255;
var blue = 240;
var ccol = 0;
var wcol = 0;
var func = [];

export function getStart(address: string) {
    return getState(address);
}

export function getMacAdr(address) {
    success = false;
    getFunctions(address);
    return mac;
}

export function getState(address: string) {
    success = false;
    getFunctions(address);
    return state;
}

export function getDimming(address: string) {
    success = false;
    getFunctions(address);
    return dimming;
}

export function getTemperature(address: string) {
    success = false;
    getFunctions(address);
    return temp;
}

export function getRGB(address: string) {
    success = false;
    getFunctions(address);
    return [red, green, blue];
}

export function getScene(address) {
    success = false;
    getFunctions(address);
    return sceneId;
}

export function getSpeed(address) {
    success = false;
    getFunctions(address);
    return speed;
}

export function getFunctions(address) {
    adress = address;
    // Function order: onoff, dimming, temperature, color, scenery
    success = false;
    var msg = '{"method":"getPilot","params":{}}';
    getMessage(msg, adress);
    return func;
}

export function setOnOff(address: string, value: boolean) {
    success = false;
    if (value) {
        var msg = '{"method":"setPilot","params":{"state":true}}';
    } else {
        var msg = '{"method":"setPilot","params":{"state":false}}';
    }
    sendMessage(msg, address);
}

export async function setBrightness(address: string, level: number) {
    success = false;

    if (level >= 10) {
        const message = { method: 'setPilot', params: { dimming: Math.min(level, 100) } };

        // var msg = util.format('{"method":"setPilot","params":{"dimming":%d}}', Math.min(level, 100));
        await sendMessage(JSON.stringify(message), address);
    } else if (level < 10) {
        await setOnOff(address, false);
    }

    // }
}

export function setLightTemp(address, level) {
    success = false;
    if ((level) => 2200 && level <= 6500) {
        var msg = util.format('{"method":"setPilot","params":{"temp":%d}}', level);
        sendMessage(msg, address);
    }
}

export function setColorRGB(address: string, red: number, green: number, blue: number, coolWhite: number, warmWhite: number) {
    success = false;
    if (red >= 0 && red <= 255) {
        if (green >= 0 && green <= 255) {
            if (blue >= 0 && blue <= 255) {
                const message = {
                    method: 'setPilot',
                    params: {
                        r: red,
                        g: green,
                        b: blue,
                        c: coolWhite,
                        w: warmWhite,
                    },
                };

                // var msg = util.format(
                //     '{"method":"setPilot","params":{"r":%d,"g":%d,"b":%d}}',
                //     Math.round(red),
                //     Math.round(green),
                //     Math.round(blue)
                // );
                sendMessage(JSON.stringify(message), address);
            }
        }
    }
}

export function onLightScene(address, scene) {
    success = false;
    if ((scene) => 1 && scene <= 32) {
        if ((speed) => 0 && speed <= 100) {
            var msg = util.format('{"method":"setPilot","params":{"sceneId":%d}}', scene);
            sendMessage(msg, address);
        }
    }
}

export function onLightSpeed(address, speed) {
    success = false;
    var msg = util.format('{"method":"setPilot","params":{"speed":%d}}', speed);
    sendMessage(msg, address);
}

// TO-DO: this can definitely improve - I'm thinking there are race conditions when firing a command before the last one
export function sendMessage(message, address: string) {
    return new Promise((resolve, reject) => {
        console.log(message);

        client.send(message, 0, message.length, PORT, address, (err) => {
            if (err) {
                console.log(err);
                reject();
            }
        });

        resolve(true);
    });
}

export function getMessage(message, adr) {
    return new Promise(function (resolve, reject) {
        const client = Dgram.createSocket('udp4');

        process.on('unhandledRejection', (error) => {
            //				console.log('unhandledRejection', error.message);
        });

        client.on('message', function (msg, info) {
            client.close();
            success = true;

            const JSonObj = JSON.parse(msg.toString('utf8')) as Record<string, unknown>;
            console.log(JSonObj);

            // if (JSonObj.hasOwnProperty('mac')) {
            //     mac = JSonObj.mac;
            // }
            // if (JSonObj.hasOwnProperty('state')) {
            //     state = JSonObj.state;
            //     func[0] = true;
            // } else {
            //     state = JSonObj.state;
            //     func[0] = false;
            // }
            // if (JSonObj.hasOwnProperty('dimming')) {
            //     dimming = JSonObj.dimming;
            //     func[1] = true;
            // } else {
            //     func[1] = false;
            // }
            // if (JSonObj.hasOwnProperty('temp')) {
            //     temp = JSonObj.temp;
            //     func[2] = true;
            // } else {
            //     func[2] = false;
            // }
            // if (JSonObj.hasOwnProperty('r')) {
            //     red = JSonObj.r;
            //     green = JSonObj.g;
            //     blue = JSonObj.b;
            //     func[3] = true;
            // } else {
            //     func[3] = false;
            // }
            // if (JSonObj.hasOwnProperty('sceneId')) {
            //     sceneId = JSonObj.sceneId;
            //     func[4] = true;
            // } else {
            //     func[4] = false;
            // }
            // if (JSonObj.hasOwnProperty('c')) {
            //     ccol = JSonObj.c;
            // }
            // if (JSonObj.hasOwnProperty('w')) {
            //     wcol = JSonObj.w;
            // }
            // if (JSonObj.hasOwnProperty('speed')) {
            //     speed = JSonObj.speed;
            // }

            resolve(msg);
        });

        client.send(message, 0, message.length, PORT, adr, function (err, bytes) {
            if (err) {
                client.close();
                success = false;
                this.log(err);
                resolve(null);
            }
        });
    });
}
