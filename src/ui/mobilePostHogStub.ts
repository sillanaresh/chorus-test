const mobilePostHog = {
    capture: () => undefined,
};

export function usePostHog() {
    return mobilePostHog;
}

export default mobilePostHog;
