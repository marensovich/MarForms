import {createContext} from "react";

/** What a file field needs from the form it's in: where to upload, or that it can't (preview). */
export interface UploadContextValue {
    slug: string | null;
    preview: boolean;
}

export const UploadContext = createContext<UploadContextValue>({slug: null, preview: false});
