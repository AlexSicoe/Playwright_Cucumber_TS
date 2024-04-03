import { IWorld, Status } from "@cucumber/cucumber";
import FixtureManager from "./FixtureManager";
import * as fs from 'fs-extra';

export default class ArtifactManager {
    shouldAttachMedia: boolean;
    shouldAttachTrace: boolean;
    img: Buffer | null;

    constructor(private world: IWorld, private fx: FixtureManager) {
        this.img = null
        let status = fx.scenario.Status;

        this.shouldAttachMedia =
            !fx.scenario.hasTag('@api') &&
            status === Status.PASSED ||
            status === Status.FAILED ||
            status === Status.UNKNOWN;
        this.shouldAttachTrace =
            status !== Status.PENDING &&
            status !== Status.SKIPPED;
    }

    async takeScreenshot(): Promise<void> {
        const currentPage = this.fx.pageManager.Page;
        if (currentPage) {
            this.img = await currentPage.screenshot({
                path: `./test-results/screenshots/${this.fx.scenario.DashedName}.png`,
                type: "png",
            });
        }
    }

    async attachMedia() {
        if (this.img) {
            await this.world.attach(this.img, "image/png");
        }

        const currentPage = this.fx.pageManager.Page;
        if (currentPage) {
            const videoPath = await currentPage.video().path();
            await this.world.attach(fs.createReadStream(videoPath), "video/webm");
        }
    }

    async attachLogs(maxLines: number = 100) {
        const logFilePath = `test-results/logs/${this.fx.scenario.DashedName}/log.log`;

        if (!await fs.pathExists(logFilePath)) {
            return;
        }

        const logContent = await fs.readFile(logFilePath, 'utf-8');
        const logLines = logContent.split('\n');
        const totalLines = logLines.length;

        if (totalLines <= 1) {
            return;
        }

        const displayedLines = Math.min(totalLines, maxLines);
        const truncatedMessage = totalLines > maxLines ? '\n[Log truncated due to excessive length]' : '';
        const displayedLogContent = logLines.slice(0, displayedLines).join('\n');

        const logInfo = `Logs (${displayedLines}/${totalLines} lines):\n${displayedLogContent}${truncatedMessage}`;

        await this.world.attach(logInfo, 'text/plain');
    }

    async attachTrace() {
        const traceFileURL = `http://localhost:${process.env.REPORT_PORT}/trace/${this.fx.scenario.DashedName}.zip`;
        const traceURL = `https://trace.playwright.dev/?trace=${traceFileURL}`;
        const traceLink = `<a href="${traceURL}">Open /trace/${this.fx.scenario.DashedName}</a>`;
        await this.world.attach(`Trace file: ${traceLink}`, "text/html");
    }
}