import { IWorld, Status } from "@cucumber/cucumber";
import FixtureManager from "./FixtureManager";
import * as fs from 'fs-extra';

export default class ArtifactManager {
    shouldAttachMedia: boolean;
    shouldAttachTrace: boolean;
    fx: FixtureManager;
    img: Buffer | null;

    constructor(fx: FixtureManager) {
        this.fx = fx;
        this.img = null
        let status = fx.Scenario.result?.status;
        const scenarioHasApiTag = fx.Scenario.pickle.tags.some(tag => tag.name === '@api');
        this.shouldAttachMedia =
            !scenarioHasApiTag &&
            status === Status.PASSED ||
            status === Status.FAILED ||
            status === Status.UNKNOWN;
        this.shouldAttachTrace =
            status !== Status.PENDING &&
            status !== Status.SKIPPED;
    }

    async takeScreenshot(): Promise<void> {
        this.img = await this.fx.page.screenshot({
            path: `./test-results/screenshots/${this.fx.ScenarioName}.png`,
            type: "png",
        });
    }

    async attachMedia(world: IWorld) {
        await world.attach(this.img, "image/png");
        const videoPath = await this.fx.page.video().path();
        await world.attach(fs.createReadStream(videoPath), "video/webm");
    }

    async attachLogs(world: IWorld, maxLines: number = 100) {
        const logFilePath = `test-results/logs/${this.fx.ScenarioName}/log.log`;

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

        await world.attach(logInfo, 'text/plain');
    }

    async attachTrace(world: IWorld) {
        const traceFileURL = `http://localhost:${process.env.REPORT_PORT}/trace/${this.fx.ScenarioName}.zip`;
        const traceURL = `https://trace.playwright.dev/?trace=${traceFileURL}`;
        const traceLink = `<a href="${traceURL}">Open /trace/${this.fx.ScenarioName}</a>`;
        await world.attach(`Trace file: ${traceLink}`, "text/html");
    }
}