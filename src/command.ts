'use strict';

const Dgram = require('dgram');
const util = require('util');

const client = Dgram.createSocket('udp4');
client.on('message', function (msg: Buffer, info: Object) {
    const JSonObj = msg.toString('utf8');

    console.log(JSonObj);
    console.log(info);
});

const PORT = 38899;

var success = false;
var speed = 0;

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

        await sendMessage(JSON.stringify(message), address);
    } else if (level < 10) {
        await setOnOff(address, false);
    }
}

export function setLightTemp(address: string, level: number) {
    success = false;
    if (level >= 2200 && level <= 6500) {
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
                        r: Math.round(red),
                        g: Math.round(green),
                        b: Math.round(blue),
                        c: Math.round(coolWhite),
                        w: Math.round(warmWhite),
                    },
                };

                sendMessage(JSON.stringify(message), address);
            }
        }
    }
}

export function onLightScene(address: string, scene: number) {
    success = false;
    if (scene >= 1 && scene <= 32) {
        if (speed >= 0 && speed <= 100) {
            var msg = util.format('{"method":"setPilot","params":{"sceneId":%d}}', scene);
            sendMessage(msg, address);
        }
    }
}

export function onLightSpeed(address: string, speed: number) {
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

export function getMessage(message, adr: string) {
    return new Promise(function (resolve, reject) {
        const client = Dgram.createSocket('udp4');

        process.on('unhandledRejection', (error) => {
            //				console.log('unhandledRejection', error.message);
        });

        client.on('message', (msg, info) => {
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
