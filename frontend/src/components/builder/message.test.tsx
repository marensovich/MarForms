// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {FormField, WebhookConfig} from "../../types/forms";
import {ToastProvider} from "../../ui";
import MessageTab from "./MessageTab";
import {fill, fromHex, messageOf, pieces, toHex} from "./discordMessage";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue" && k !== "count").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
vi.mock("../../api/dashboard", () => ({
    getGuildRoles: () => Promise.resolve([{id: "11", name: "Модератор", color: 0x22c55e}]),
}));
vi.mock("../../hooks/useAuth", () => ({useAuth: () => ({user: {id: "5", discordUsername: "dmitry"}})}));

describe("the report as Discord shows it", () => {
    it("joins the form's text and the channel's, fills variables and finds mentions", () => {
        expect(messageOf(" <@&11> новый ответ ", "проверьте")).toBe("<@&11> новый ответ\nпроверьте");
        expect(messageOf("", undefined)).toBe("");
        expect(fill("{form.title} от {user.name} {unknown}", {"form.title": "LSPD", "user.name": "dmitry"})).toBe("LSPD от dmitry {unknown}");
        expect(pieces("эй <@&11>, <@5>!")).toEqual([{text: "эй "}, {role: "11"}, {text: ", "}, {user: "5"}, {text: "!"}]);
        expect(fromHex("#22c55e")).toBe(0x22c55e);
        expect(fromHex("red")).toBeNull();
        expect(toHex(undefined)).toBe("#5865f2");
    });
});

const FIELDS: FormField[] = [{id: "a", type: "TEXT", label: "Ваш ник", required: true}];
const HOOKS: WebhookConfig[] = [
    {url: "https://discord.com/api/webhooks/1/***", channelName: "заявки"},
    {url: "https://discord.com/api/webhooks/2/***", channelName: "руководство"},
];

function Harness({onChange}: { onChange: (w: WebhookConfig[]) => void }) {
    const [webhooks, setWebhooks] = useState(HOOKS);
    const [message, setMessage] = useState("Для всех");
    return (
        <ToastProvider>
            <MessageTab guildId="9" guildName="GTA5RP" formTitle="LSPD" formSlug="lspd" reviewEnabled={false} fields={FIELDS}
                        message={message} onMessage={setMessage} webhooks={webhooks}
                        onWebhooks={w => {
                            setWebhooks(w);
                            onChange(w);
                        }}/>
        </ToastProvider>
    );
}

describe("«Сообщение»", () => {
    afterEach(() => cleanup());

    it("gives each channel its own text and embed, and previews them", async () => {
        const user = userEvent.setup();
        const changed = vi.fn();
        render(<Harness onChange={changed}/>);
        const preview = () => within(screen.getByRole("figure", {name: "builder.message.previewTitle"}));

        expect(preview().getByText("Ваш ник")).toBeTruthy();
        expect(preview().getByText("LSPD")).toBeTruthy();

        await user.click(screen.getByRole("tab", {name: /руководство/}));
        await user.type(screen.getByLabelText("builder.message.channelText:#руководство"), "Срочно");
        await user.type(screen.getByLabelText("builder.message.footerText"), "Сервер {{server.name}");

        const last = changed.mock.calls.at(-1)![0] as WebhookConfig[];
        expect(last[0].content).toBeUndefined();
        expect(last[1]).toMatchObject({content: "Срочно", footerText: "Сервер {server.name}"});
        expect(preview().getByText("Для всех Срочно", {normalizer: s => s.replace(/\s+/g, " ")})).toBeTruthy();
        expect(preview().getByText(/Сервер GTA5RP/)).toBeTruthy();

        await user.click(screen.getByRole("button", {name: "builder.message.copyLook"}));
        const copied = changed.mock.calls.at(-1)![0] as WebhookConfig[];
        // The look goes to the other channel; its own text stays its own.
        expect(copied[0]).toMatchObject({footerText: "Сервер {server.name}"});
        expect(copied[0].content).toBeUndefined();
    });

    it("says a link is wrong before the server refuses it", async () => {
        const user = userEvent.setup();
        render(<Harness onChange={vi.fn()}/>);
        await user.type(screen.getByLabelText("builder.message.thumbnailUrl"), "картинка");
        expect(screen.getByText("builder.message.badLink")).toBeTruthy();
    });
});
