import {createContext} from "react";
import type {UploadedFile} from "../../../api/forms";

/** What a file field needs from the form it's in: where to upload, or that it can't (preview). */
export interface UploadContextValue {
    slug: string | null;
    preview: boolean;
    /** Files a submission sent back for revision already carries, by ID (#119). */
    knownFiles?: Record<string, UploadedFile>;
}

export const UploadContext = createContext<UploadContextValue>({slug: null, preview: false});
