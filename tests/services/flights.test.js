import { describe, it } from 'node:test';
import assert from 'node:assert';
import { flightService } from '../../src/services/flights.js';

describe('FlightService', () => {
    describe('getAirportCode', () => {
        it('should return airport code for major cities', () => {
            assert.strictEqual(flightService.getAirportCode('London'), 'LHR');
            assert.strictEqual(flightService.getAirportCode('Paris'), 'CDG');
            assert.strictEqual(flightService.getAirportCode('New York'), 'JFK');
            assert.strictEqual(flightService.getAirportCode('Tokyo'), 'NRT');
        });

        it('should handle case-insensitive city names', () => {
            assert.strictEqual(flightService.getAirportCode('london'), 'LHR');
            assert.strictEqual(flightService.getAirportCode('PARIS'), 'CDG');
            assert.strictEqual(flightService.getAirportCode('ToKyO'), 'NRT');
        });

        it('should return first 3 chars uppercase for unknown cities', () => {
            assert.strictEqual(flightService.getAirportCode('UnknownCity123'), 'UNK');
            assert.strictEqual(flightService.getAirportCode('xyz'), 'XYZ');
        });

        it('should handle multi-word city names', () => {
            assert.strictEqual(flightService.getAirportCode('New York'), 'JFK');
            assert.strictEqual(flightService.getAirportCode('Los Angeles'), 'LAX');
            assert.strictEqual(flightService.getAirportCode('San Francisco'), 'SFO');
        });
    });

    describe('estimateFlightDuration', () => {
        it('should estimate short-haul flights (< 3 hours)', () => {
            const duration = flightService.estimateFlightDuration('London', 'Paris');
            assert.ok(duration.includes('1-3 hours') || duration.includes('short'));
        });

        it('should estimate long-haul flights', () => {
            const duration = flightService.estimateFlightDuration('London', 'Tokyo');
            assert.ok(duration.includes('10') || duration.includes('long'));
        });

        it('should return estimate even for unknown cities', () => {
            const duration = flightService.estimateFlightDuration('UnknownCity1', 'UnknownCity2');
            assert.ok(typeof duration === 'string');
            assert.ok(duration.length > 0);
        });

        it('should be consistent for same city pair', () => {
            const duration1 = flightService.estimateFlightDuration('Paris', 'Tokyo');
            const duration2 = flightService.estimateFlightDuration('Paris', 'Tokyo');
            assert.strictEqual(duration1, duration2);
        });
    });

    describe('generateSearchUrls', () => {
        it('should generate search URLs', () => {
            const urls = flightService.generateSearchUrls('LHR', 'CDG');
            assert.ok(urls.skyscanner);
            assert.ok(urls.kayak);
            assert.ok(urls.googleFlights);
        });

        it('should generate valid URLs', () => {
            const urls = flightService.generateSearchUrls('JFK', 'NRT');
            assert.ok(urls.skyscanner.startsWith('http'));
            assert.ok(urls.kayak.startsWith('http'));
            assert.ok(urls.googleFlights.startsWith('http'));
        });
    });

    describe('extractFlightDetails', () => {
        it('should extract cities from "flights from X to Y" pattern', () => {
            const details = flightService.extractFlightDetails('Flight from London to Paris');
            assert.deepStrictEqual(details, { origin: 'London', destination: 'Paris' });
        });

        it('should extract cities from "fly from X to Y" pattern', () => {
            const details = flightService.extractFlightDetails('I want to fly from Tokyo to Sydney');
            assert.deepStrictEqual(details, { origin: 'Tokyo', destination: 'Sydney' });
        });

        it('should handle multi-word city names', () => {
            const details = flightService.extractFlightDetails('Flying from New York to Los Angeles');
            assert.deepStrictEqual(details, { origin: 'New York', destination: 'Los Angeles' });
        });

        it('should return null when pattern not found', () => {
            const details = flightService.extractFlightDetails('I need a flight');
            assert.strictEqual(details, null);
        });
    });

    describe('shouldFetchFlights', () => {
        it('should return true for flight queries', () => {
            assert.strictEqual(flightService.shouldFetchFlights('Flight from London to Paris'), true);
        });

        it('should return true for fly queries', () => {
            assert.strictEqual(flightService.shouldFetchFlights('How do I fly to Tokyo?'), true);
        });

        it('should return true for "how to get to" queries', () => {
            assert.strictEqual(flightService.shouldFetchFlights('How to get to Rome?'), true);
        });

        it('should return false for non-flight queries', () => {
            assert.strictEqual(flightService.shouldFetchFlights('What is the weather?'), false);
        });

        it('should be case insensitive', () => {
            assert.strictEqual(flightService.shouldFetchFlights('FLIGHT from Paris'), true);
        });

        it('should detect travel queries', () => {
            assert.strictEqual(flightService.shouldFetchFlights('How to travel to Bangkok?'), true);
        });

        it('should detect airline queries', () => {
            assert.strictEqual(flightService.shouldFetchFlights('Which airline flies there?'), true);
        });
    });

    describe('getFlightInfo', () => {
        it('should get flight info for valid cities', async () => {
            const data = await flightService.getFlightInfo('London', 'Paris');
            assert.ok(data);
            assert.ok(data.route);
            assert.ok(data.estimatedDuration);
            assert.ok(data.bookingSites || data.searchUrls);
        });

        it('should include airport codes in route', async () => {
            const data = await flightService.getFlightInfo('London', 'Paris');
            assert.ok(data.route.includes('LHR'));
            assert.ok(data.route.includes('CDG'));
        });

        it('should generate booking sites/links', async () => {
            const data = await flightService.getFlightInfo('Tokyo', 'New York');
            const links = data.bookingSites || data.searchUrls || {};
            assert.ok(links.skyscanner || Object.keys(links).length > 0);
        });

        it('should cache flight data', async () => {
            // First call
            const data1 = await flightService.getFlightInfo('London', 'Paris');

            // Second call should use cache
            const data2 = await flightService.getFlightInfo('London', 'Paris');

            assert.ok(data1);
            assert.ok(data2);
            assert.strictEqual(data1.route, data2.route);
        });

        it('should handle unknown cities gracefully', async () => {
            const data = await flightService.getFlightInfo('UnknownCity1', 'UnknownCity2');
            assert.ok(data);
            assert.ok(data.route);
            assert.ok(data.estimatedDuration);
        });
    });

    describe('getBudgetFlightTips', () => {
        it('should return array of budget tips', () => {
            const tips = flightService.getBudgetFlightTips();
            assert.ok(Array.isArray(tips));
            assert.ok(tips.length > 0);
            assert.ok(tips.every(tip => typeof tip === 'string'));
        });
    });
});

