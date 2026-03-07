import type { Config } from 'tailwindcss';
import sharedConfig from '@repo/tailwind-config';

const config: Config = {
    ...sharedConfig,
    content: ['./src/**/*.{ts,tsx}'],
};

export default config;
