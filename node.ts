import { dmxnet } from 'dmxnet';
import { setBrightness, setColorRGB } from './command';

const artnetNode = new dmxnet({
    log: { level: 'info' }, // Winston logger options
    oem: 0, // OEM Code from artisticlicense, default to dmxnet OEM.
    sName: 'Cloudy-Oh Jo', // 17 char long node description, default to "dmxnet"
    lName: 'Cloudy-Oh ArtNet Transceiver', // 63 char long node description, default to "dmxnet - OpenSource ArtNet Transceiver"
    hosts: ['127.0.0.1'], // Interfaces to listen to, all by default
});

const bulbs = ['192.168.0.198'];

const lastValuesPerBulb: Record<string, { r: number; g: number; b: number; brightness: number }> = {};

const receiver = artnetNode.newReceiver({
    subnet: 0, //Destination subnet, default 0
    universe: 0, //Destination universe, default 0
    net: 0, //Destination net, default 0
});

receiver.on('data', async (data) => {
    // console.log('DMX data:', data);

    // TO-DO: hier dan data doorgeven aan WiZ shizzle
    // console.log(new Date() + ' ' + data[3]);
    // console.log(data[0]);

    const brightness = calculateBrightness(data[0]);

    if (shouldUpdateValues('192.168.0.198', data[1], data[2], data[3], brightness)) {
        console.log('voert commando uit!');

        // Set this before actually executing the values, as they are async
        lastValuesPerBulb['192.168.0.198'] = {
            r: data[1],
            g: data[2],
            b: data[3],
            brightness,
        };

        await setBrightness('192.168.0.198', brightness);

        if (brightness > 0) {
            await setColorRGB('192.168.0.198', data[1], data[2], data[3]);
        }
    }
});

// This method returns either 0, or a value between 10 and a 100
// Values below 10 are somehow not supported in the WiZ implementation
function calculateBrightness(input: number) {
    if (input === 0) {
        return 0;
    }

    return Math.round(0.354330708661 * input + 9.64566929134);
}

function shouldUpdateValues(address: string, r: number, g: number, b: number, brightness: number) {
    if (!lastValuesPerBulb[address]) {
        return true;
    }

    if (
        lastValuesPerBulb[address] &&
        (lastValuesPerBulb[address].r !== r ||
            lastValuesPerBulb[address].g !== g ||
            lastValuesPerBulb[address].b !== b ||
            lastValuesPerBulb[address].brightness !== brightness)
    ) {
        return true;
    }

    return false;
}

// async function dinges() {
//     // console.log(command);
//     // console.log(command.getDimming('192.168.0.198'));
//     console.log(command.getRGB('192.168.0.198'));

//     // // command.setOnOff('192.168.0.198', false);
//     await command.setOnOff('192.168.0.198', false);

//     // command.setBrightness('192.168.0.198', 12);
//     await command.setColorRGB('192.168.0.198', 255, 0, 0);

//     // await command.setOnOff('192.168.0.198', false);
// }

// dinges();
