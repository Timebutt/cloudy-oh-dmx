import { createServer } from 'http';
import { Subject, throttleTime } from 'rxjs';
import { PacketLengthParser, SerialPort } from 'serialport';
import { Bulb, discover } from 'wikari';
import { setBrightness, setColorRGB } from './command';

// See https://cdn.enttec.com/pdf/assets/70304/70304_DMX_USB_PRO_API.pdf for documentation
// on the Enttec Pro USB DMX communication implementation details.

const dmxChannels = 5;

const bulbIpAddresses: string[] = [];
const bulbDmxAddresses: Record<string, number> = {};
const wikariBulbs: Record<string, Bulb> = {};

const subject$ = new Subject<any>();

// const globalBulbs: { ipAddress: string; dmxAddress: string }[] = [];
const lastValuesPerBulb: Record<
    string,
    { red: number; green: number; blue: number; coolWhite: number; warmWhite: number; brightness: number }
> = {};

(async () => {
    const discoveredBulbs = await discover({});
    for (const bulb of discoveredBulbs) {
        if (!bulbIpAddresses.find((ipAddress) => ipAddress === bulb.address)) {
            bulbIpAddresses.push(bulb.address);
            bulbDmxAddresses[bulb.address] = null;
        }
        wikariBulbs[bulb.address] = bulb;
    }

    console.log('Found these bulbs at startup:');
    console.log(bulbIpAddresses);

    const portInfo = await SerialPort.list();
    const dmxProInterface = portInfo.find((port) => port.manufacturer === 'ENTTEC');

    if (dmxProInterface) {
        console.log('Enttec DMX interface found - starting listener!');
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
                maxLen: 1024,
            })
        );

        // The throttleTime(300) seems to help wtih not overloading the Wiz bulb with commands at times
        subject$.pipe(throttleTime(300)).subscribe(async (dmxData) => {
            for (const ipAddress of bulbIpAddresses) {
                // If no DMX channel is assigned to this bulb, don't do anything
                const dmxAddress = bulbDmxAddresses[ipAddress];
                if (!dmxAddress) {
                    continue;
                }

                // There's not enough DMX data for a fixture mapped to this address
                if (dmxData.length < dmxAddress + dmxChannels) {
                    console.log('DMX fixture out of range!');
                    continue;
                }

                const [intensity, red, green, blue, coolWhite, warmWhite] = dmxData.slice(dmxAddress - 1, dmxAddress + dmxChannels);
                const brightness = calculateBrightness(intensity);
                if (shouldUpdateValues(ipAddress, red, green, blue, coolWhite, warmWhite, brightness)) {
                    // No Wikari bulb found
                    const bulb = wikariBulbs[ipAddress];
                    if (!bulb) {
                        continue;
                    }

                    // Set this before actually executing the values, as they are async
                    lastValuesPerBulb[ipAddress] = {
                        red,
                        green,
                        blue,
                        coolWhite,
                        warmWhite,
                        brightness,
                    };

                    if (brightness > 0) {
                        console.log('color', { r: red, g: green, b: blue, c: coolWhite, w: warmWhite });
                        try {
                            setBrightness(ipAddress, brightness);
                        } catch {
                            console.log('probleemke daar');
                        }
                    }

                    try {
                        setColorRGB(ipAddress, red, green, blue, coolWhite, warmWhite);
                    } catch {
                        console.log('probleemke hier');
                    }

                    console.log('Updated values for bulb', ipAddress, dmxAddress, red, green, blue, coolWhite, warmWhite, brightness);
                }
            }
        });

        parser.on('data', async (data) => {
            const dmxData = data.toJSON().data.slice(6, data.length - 7);
            subject$.next(dmxData);
        });
    } else {
        console.log('Enttec DMX interface not found, exiting!');
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

// Set up HTTP server
createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Request-Method', '*');
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    response.setHeader('Access-Control-Allow-Headers', '*');

    if (request.method === 'OPTIONS') {
        response.writeHead(200);
        response.end();
        return;
    } else if (request.method == 'POST') {
        let body = '';
        request.on('data', (data) => (body += data));
        request.on('end', async () => {
            const parsedBody = body ? JSON.parse(body) : null;

            switch (true) {
                // Set color for a single bulb
                case request.url.startsWith('/setColor'): {
                    if (!body) {
                        response.writeHead(400);
                        response.end('Needs POST body');
                        return;
                    }

                    const { ipAddress, red, green, blue, coolWhite, warmWhite } = parsedBody;
                    if (
                        typeof ipAddress !== 'string' ||
                        typeof red !== 'number' ||
                        typeof green !== 'number' ||
                        typeof blue !== 'number' ||
                        typeof coolWhite !== 'number' ||
                        typeof warmWhite !== 'number'
                    ) {
                        response.writeHead(400);
                        response.end('Invalid values');
                        return;
                    }

                    const bulb = wikariBulbs[ipAddress];
                    if (!bulb) {
                        response.writeHead(400);
                        response.end('No such bulb');
                        return;
                    }

                    await bulb.color({ r: red, g: green, b: blue, c: coolWhite, w: warmWhite });
                    break;
                }

                // Set brightness for a single bulb
                case request.url.startsWith('/setBrightness'): {
                    if (!body) {
                        response.writeHead(400);
                        response.end('Needs POST body');
                        return;
                    }

                    const { ipAddress, brightness } = parsedBody;
                    if (typeof brightness !== 'string') {
                        response.writeHead(400);
                        response.end('Invalid brightness');
                        return;
                    }

                    // const bulb = wikariBulbs[ipAddress];
                    // if (!bulb) {
                    //     response.writeHead(400);
                    //     response.end('No such bulb');
                    //     return;
                    // }

                    await setBrightness(ipAddress, calculateBrightness((parseInt(brightness, 10) / 100) * 255));
                    break;
                }

                // Set DMX address for bulbs
                case request.url.startsWith('/setDmxChannels'): {
                    if (!body) {
                        response.writeHead(400);
                        response.end('Needs POST body');
                        return;
                    }

                    const { bulbs } = parsedBody;

                    if (!Array.isArray(bulbs)) {
                        response.writeHead(400);
                        response.end('Bulbs is not array');
                        return;
                    }

                    for (const bulb of bulbs) {
                        const matchingBulbIpAddress = bulbIpAddresses.find((ipAddress) => bulb.ipAddress === ipAddress);
                        if (matchingBulbIpAddress && typeof bulb.dmxAddress === 'string') {
                            bulbDmxAddresses[matchingBulbIpAddress] = parseInt(bulb.dmxAddress);
                        }
                    }

                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify(mapToBulbResponse()));
                    break;
                }

                // No matching endpoint found
                default: {
                    response.writeHead(404);
                    response.end('Not found');
                    break;
                }
            }
        });
    } else if (request.method === 'GET') {
        switch (true) {
            // Bulbs endpoint
            case request.url.startsWith('/bulbs'):
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ bulbs: mapToBulbResponse() }));
                break;

            // Trigger discover of bulbs
            case request.url.startsWith('/discover'):
                const discoveredBulbs = await discover({});

                // Add new bulbs
                for (const bulb of discoveredBulbs) {
                    if (!bulbIpAddresses.find((ipAddress) => ipAddress === bulb.address)) {
                        bulbIpAddresses.push(bulb.address);
                        bulbDmxAddresses[bulb.address] = null;
                        wikariBulbs[bulb.address] = bulb;
                    }
                }

                // Remove no-longer existing bulbs
                for (const ipAddress of bulbIpAddresses) {
                    if (!discoveredBulbs.find(({ address }) => address === ipAddress)) {
                        // globalBulbs = globalBulbs.push({ ipAddress: bulb.address, dmxAddress: null });
                        console.log('remove bulb with address', ipAddress);
                    }
                }

                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ bulbs: mapToBulbResponse() }));
                break;

            // No matching endpoint found
            default:
                response.writeHead(200);
                response.end('Not found');
                break;
        }
    }
}).listen(9000);

const mapToBulbResponse = () => bulbIpAddresses.map((ipAddress) => ({ ipAddress, dmxAddress: bulbDmxAddresses[ipAddress] }));
