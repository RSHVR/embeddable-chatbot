export default LiquidGlass;
type LiquidGlass = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const LiquidGlass: import("svelte").Component<{
    children: any;
    contrast?: string;
    roundness?: number;
    blur?: number;
    opacity?: number;
}, {}, "">;
type $$ComponentProps = {
    children: any;
    contrast?: string;
    roundness?: number;
    blur?: number;
    opacity?: number;
};
