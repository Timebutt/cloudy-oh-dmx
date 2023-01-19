import { PacketLengthParser, SerialPort } from 'serialport';
import { setBrightness, setColorRGB } from './command';

// See https://cdn.enttec.com/pdf/assets/70304/70304_DMX_USB_PRO_API.pdf for documentation
// on the Enttec Pro USB DMX communication implementation details.

const dmxChannels = 5;
const bulbs = [
    { dmxAddress: 1, ipAddress: '192.168.0.100' },
    { dmxAddress: 9, ipAddress: '192.168.0.102' },
];
const lastValuesPerBulb: Record<
    string,
    { red: number; green: number; blue: number; coolWhite: number; warmWhite: number; brightness: number }
> = {};

(async () => {
    const portInfo = await SerialPort.list();
    const dmxProInterface = portInfo.find((port) => port.manufacturer === 'ENTTEC');

    if (dmxProInterface) {
        const port = new SerialPort({
            path: dmxProInterface.path,
            baudRate: 250000,
        });

        const parser = port.pipe(
            new PacketLengthParser({
                delimiter: 0x7e,
                packetOverhead: 5,
                lengthBytes: 2,
                lengthOffset: 2,
            })
        );
        parser.on('data', async (data) => {
            const dmxData = data.toJSON().data.slice(6, data.length - 7);
            for (const bulb of bulbs) {
                // There's not enough DMX data for a fixture mapped to this address
                if (dmxData.length < bulb.dmxAddress + dmxChannels) {
                    console.log('DMX fixture out of range!');
                    continue;
                }

                const [intensity, red, green, blue, coolWhite, warmWhite] = dmxData.slice(
                    bulb.dmxAddress - 1,
                    bulb.dmxAddress + dmxChannels
                );
                const brightness = calculateBrightness(intensity);
                if (shouldUpdateValues(bulb.ipAddress, red, green, blue, coolWhite, warmWhite, brightness)) {
                    // Set this before actually executing the values, as they are async
                    lastValuesPerBulb[bulb.ipAddress] = {
                        red,
                        green,
                        blue,
                        coolWhite,
                        warmWhite,
                        brightness,
                    };

                    await setBrightness(bulb.ipAddress, brightness);

                    if (brightness > 0) {
                        await setColorRGB(bulb.ipAddress, red, green, blue, coolWhite, warmWhite);
                    }
                }
            }
        });
    }
})();

// This method returns either 0, or a value between 10 and a 100
// Values below 10 are somehow not supported in the WiZ implementation
function calculateBrightness(input: number) {
    if (input === 0) {
        return 0;
    }

    return Math.round(0.354330708661 * input + 9.64566929134);
}

function shouldUpdateValues(
    address: string,
    red: number,
    green: number,
    blue: number,
    coolWhite: number,
    warmWhite: number,
    brightness: number
) {
    if (!lastValuesPerBulb[address]) {
        return true;
    }

    if (
        lastValuesPerBulb[address] &&
        (lastValuesPerBulb[address].red !== red ||
            lastValuesPerBulb[address].green !== green ||
            lastValuesPerBulb[address].blue !== blue ||
            lastValuesPerBulb[address].coolWhite !== coolWhite ||
            lastValuesPerBulb[address].warmWhite !== warmWhite ||
            lastValuesPerBulb[address].brightness !== brightness)
    ) {
        return true;
    }

    return false;
}
