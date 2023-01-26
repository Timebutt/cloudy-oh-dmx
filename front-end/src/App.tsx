import Coloris from '@melloware/coloris';
import '@melloware/coloris/dist/coloris.css';
import { Component, createResource, Index } from 'solid-js';

import styles from './App.module.css';

const fetchBulbs = async (): Promise<{ bulbs: { dmxAddress: number; ipAddress: string }[] }> =>
    (await fetch(`http://localhost:9000/bulbs`)).json();

// TO-DO: use https://tanstack.com/table/v8
// https://codesandbox.io/s/solidjs-submit-form-with-store-6kh4c?file=/src/useForm.ts:711-722

const App: Component = () => {
    const [bulbs] = createResource(fetchBulbs);

    Coloris.init();
    Coloris({ el: '.coloris', format: 'rgb', alpha: false });

    async function saveConfiguration() {
        const dmxAddressInputFields = Array.from(document.querySelectorAll<HTMLInputElement>('input.dmx-address'));
        const updatedBulbs = dmxAddressInputFields.map((inputField) => ({
            ipAddress: inputField.getAttribute('data-ipaddress'),
            dmxAddress: inputField.value,
        }));

        const result = await fetch('http://localhost:9000/setDmxChannels', {
            method: 'POST',
            body: JSON.stringify({ bulbs: updatedBulbs }),
            headers: {
                'Content-Type': 'application/json',
            },
        }).then((response) => response.json() as Promise<{ bulbs: { ipAddress: string; dmxAddress: string }[] }>);
    }

    async function discoverBulbs() {
        const response = await fetch('http://localhost:9000/discover').then(
            (response) => response.json() as Promise<{ bulbs: { ipAddress: string; dmxAddress: string }[] }>
        );
    }

    async function setColor(ipAddress: string) {
        const color = document.querySelector<HTMLInputElement>(`.coloris[data-ipaddress="${ipAddress}"]`)?.value;

        if (!color) {
            return;
        }

        const matchedString = color.match(/(\d{1,3}), (\d{1,3}), (\d{1,3})/gm)?.[0];
        if (!matchedString) {
            return;
        }

        const [red, green, blue] = matchedString.split(',').map((value) => parseInt(value, 10));
        await fetch('http://localhost:9000/setColor', {
            method: 'POST',
            body: JSON.stringify({ ipAddress, red, green, blue, warmWhite: 0, coolWhite: 0 }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async function setBrightness(ipAddress: string) {
        const brightness = document.querySelector<HTMLInputElement>(`.brightness[data-ipaddress="${ipAddress}"]`)?.value;
        await fetch('http://localhost:9000/setBrightness', {
            method: 'POST',
            body: JSON.stringify({ ipAddress, brightness }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async function setWarmWhite(ipAddress: string) {
        await fetch('http://localhost:9000/setColor', {
            method: 'POST',
            body: JSON.stringify({ ipAddress, red: 0, green: 0, blue: 0, warmWhite: 100, coolWhite: 0 }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async function setCoolWhite(ipAddress: string) {
        await fetch('http://localhost:9000/setColor', {
            method: 'POST',
            body: JSON.stringify({ ipAddress, red: 0, green: 0, blue: 0, warmWhite: 0, coolWhite: 100 }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    return (
        <div class={styles.App}>
            <header class={styles.header}>Cloudy-Oh Cloud Configurator</header>

            <h2>Bulbs</h2>
            <div class="flex justify-center border-separate [border-spacing:0.75rem]">
                <table class="table-fixed">
                    <thead>
                        <tr>
                            <th></th>
                            <th>IP Address</th>
                            <th>DMX Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        <Index each={bulbs()?.bulbs}>
                            {(bulb, i) => (
                                <tr>
                                    <td>{i + 1}</td>
                                    <td>{bulb().ipAddress}</td>
                                    <td>
                                        <input
                                            type="number"
                                            class="dmx-address"
                                            data-ipAddress={bulb().ipAddress}
                                            value={bulb().dmxAddress}
                                        />
                                    </td>
                                    <td>
                                        <input type="text" data-ipAddress={bulb().ipAddress} class="coloris" />
                                        <button class="btn btn-blue" onClick={() => setColor(bulb().ipAddress)}>
                                            Set Color
                                        </button>
                                    </td>
                                    <td>
                                        <input type="text" data-ipAddress={bulb().ipAddress} class="brightness" />
                                        <button class="btn btn-blue" onClick={() => setBrightness(bulb().ipAddress)}>
                                            Set Brightness
                                        </button>
                                    </td>
                                    <td>
                                        <button class="btn btn-blue" onClick={() => setWarmWhite(bulb().ipAddress)}>
                                            Set Warm White
                                        </button>
                                    </td>
                                    <td>
                                        <button class="btn btn-blue" onClick={() => setCoolWhite(bulb().ipAddress)}>
                                            Set Cool White
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </Index>
                    </tbody>
                </table>
            </div>

            <div class="flex justify-center mt-2 gap-2">
                <button class="btn btn-blue" onClick={saveConfiguration}>
                    Update DMX Addresses
                </button>
                <button class="btn btn-blue" onClick={discoverBulbs}>
                    Discover Bulbs
                </button>
            </div>
        </div>
    );
};

export default App;
