import type { Config } from 'tailwindcss';

const config: Omit<Config, 'content'> = {
    theme: {
        extend: {
            // Add your shared colors, fonts, etc. here
        },
    },
    plugins: [],
};

export default config;
