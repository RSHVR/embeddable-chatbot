export default ChatInput;
type ChatInput = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const ChatInput: import("svelte").Component<{
    onSend?: Function;
    placeholder?: string;
    disabled?: boolean;
    textColor?: string;
    iconColor?: string;
}, {}, "">;
type $$ComponentProps = {
    onSend?: Function;
    placeholder?: string;
    disabled?: boolean;
    textColor?: string;
    iconColor?: string;
};
