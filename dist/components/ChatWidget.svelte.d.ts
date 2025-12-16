export default ChatWidget;
type ChatWidget = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const ChatWidget: import("svelte").Component<{
    messages?: any[];
    isLoading?: boolean;
}, {}, "">;
type $$ComponentProps = {
    messages?: any[];
    isLoading?: boolean;
};
