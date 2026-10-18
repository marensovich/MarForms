// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {MyGuild} from "../../../api/dashboard";
import BillingPanel from "./BillingPanel";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.values(o);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
vi.mock("../../../api/dashboard", () => ({
    getGuildUsage: () => Promise.resolve({plan: "FREE", usage: [
        {metric: "ACTIVE_FORMS", used: 4, limit: 5},
        {metric: "SUBMISSIONS_PER_MONTH", used: 120, limit: null},
        {metric: "MODERATORS", used: 2, limit: 3},
        {metric: "FILE_STORAGE", used: 37, limit: 500},
    ]}),
}));

const guild = {guildId: "9", guildName: "LSRP", botStatus: "CONNECTED", role: "OWNER", since: ""} as MyGuild;

describe("server plan", () => {
    afterEach(cleanup);

    it("shows the plan's limits and what is used, with paid plans as «Скоро»", async () => {
        render(<BillingPanel guild={guild}/>);
        expect(await screen.findByRole("heading", {name: "Free"})).toBeTruthy();
        expect(screen.getByText("plan.usedOf:4,5")).toBeTruthy();
        expect(screen.getByText("plan.usedUnlimited:120")).toBeTruthy();
        expect(screen.getByText("plan.usedOf:plan.mb:37,plan.mb:500")).toBeTruthy();
        expect(screen.getAllByRole("button", {name: "plan.soon"}).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    });
});
