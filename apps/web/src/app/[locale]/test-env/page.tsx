export default function TestEnvPage() {
    const secret = process.env.JWT_SECRET;
    const publicApi = process.env.NEXT_PUBLIC_API_URL;

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">Env Test</h1>
            <p><strong>JWT_SECRET:</strong> {secret ? 'SET (length: ' + secret.length + ')' : 'NOT SET'}</p>
            <p><strong>NEXT_PUBLIC_API_URL:</strong> {publicApi || 'NOT SET'}</p>
            <hr className="my-4" />
            <p>If JWT_SECRET is NOT SET, then the .env file is not being loaded correctly by Next.js.</p>
        </div>
    );
}
