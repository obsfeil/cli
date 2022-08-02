import { request } from '../../spec-utils/httpRequest';
import { Log, LogLevel } from '../../spec-utils/log';
import { output } from './publish';

const semverCompare = require('semver-compare');
const semver = require('semver');

interface versions {
    name: string;
    tags: string[];
}

export async function getPublishedVersions(featureId: string, registry: string, namespace: string, output: Log) {
    const url = `https://${registry}/v2/${namespace}/${featureId}/tags/list`;
    const id = `${registry}/${namespace}/${featureId}`;

    try {
        const headers = {
            'user-agent': 'devcontainer',
            'Authorization': await getAuthenticationToken(output, registry, id),
            'Accept': 'application/json',
        };

        const options = {
            type: 'GET',
            url: url,
            headers: headers
        };

        const response = await request(options, output);
        const publishedVersionsResponse: versions = JSON.parse(response.toString());

        return publishedVersionsResponse.tags;
    } catch (e) {
        // Publishing for the first time
        if (e && e.code === 403) {
            return [];
        }

        output.write(`(!) ERR: Failed to publish feature: ${e?.message ?? ''} `, LogLevel.Error);
        return undefined;
    }
}

export function getSermanticVersions(version: string, publishedVersions: string[]) {
    let semanticVersions: string[] = [];
    if (semver.valid(version) === null) {
        output.write(`Skipping as version ${version} is not a valid semantic version...`);
        return null;
    }

    // Add semantic versions ex. 1.2.3 --> [1, 1.2, 1.2.3]
    const parsedVersion = semver.parse(version);

    semanticVersions.push(parsedVersion.major);
    semanticVersions.push(`${parsedVersion.major}.${parsedVersion.minor}`);
    semanticVersions.push(version);

    let publishLatest = true;
    if (publishedVersions.length > 0) {
        const sortedVersions = publishedVersions.sort(semverCompare);

        // Compare version with the last published version
        publishLatest = semverCompare(version, sortedVersions[sortedVersions.length - 1]) === 1 ? true : false;
    }

    if (publishLatest) {
        semanticVersions.push('latest');
    }

    return semanticVersions;
}

async function getAuthenticationToken(output: Log, registry: string, id: string): Promise<string> {
    if (registry === 'ghcr.io') {
        const token = await getGHCRtoken(output, id);
        return 'Bearer ' + token;
    }

    return '';
}

export async function getGHCRtoken(output: Log, id: string) {
    const headers = {
        'user-agent': 'devcontainer',
    };

    const url = `https://ghcr.io/token?scope=repo:${id}:pull&service=ghcr.io`;

    const options = {
        type: 'GET',
        url: url,
        headers: headers
    };

    const token = JSON.parse((await request(options, output)).toString()).token;

    return token;
}
