import { Helmet } from "react-helmet-async";

export const SEO = () => (
    <Helmet>
        <title>Velvii – Best Dating App | Meet Singles Near You</title>
        <meta
            name="description"
            content="Velvii is the best online dating & social discovery platform like Tantan and Tinder. Meet singles, chat, date, or find friendships instantly."
        />
        <meta
            name="keywords"
            content="Tantan, dating app, best dating site, hotchat, paid dating, tinder alternative, meet singles, local dating, global dating, matrimony, marriage app"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://velvii.vercel.app" />

        {/* OpenGraph */}
        <meta property="og:title" content="Velvii – Global Dating & Chat App" />
        <meta
            property="og:description"
            content="Swipe. Match. Chat. Meet. Velvii is the best dating alternative to Tantan & Tinder."
        />
        <meta property="og:url" content="https://velvii.vercel.app" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/velvii-og-image.png" />

        {/* Mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Helmet>
);
