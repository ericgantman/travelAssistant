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

    describe('getRouteType', () => {
        it('should identify short-haul routes', () => {
            const routeType = flightService.getRouteType('London', 'Paris');
            assert.ok(['short_haul', 'medium_haul'].includes(routeType));
        });

        it('should identify long-haul routes', () => {
            const routeType = flightService.getRouteType('London', 'Tokyo');
            assert.strictEqual(routeType, 'long_haul');
        });

        it('should handle unknown cities', () => {
            const routeType = flightService.getRouteType('UnknownCity1', 'UnknownCity2');
            assert.ok(['short_haul', 'medium_haul', 'long_haul'].includes(routeType));
        });
    });

    describe('getRealisticAirlines', () => {
        it('should return array of airlines', () => {
            const airlines = flightService.getRealisticAirlines('London', 'Paris');
            assert.ok(Array.isArray(airlines));
            assert.ok(airlines.length > 0);
            assert.ok(airlines.every(a => typeof a === 'string'));
        });

        it('should return European airlines for European routes', () => {
            const airlines = flightService.getRealisticAirlines('London', 'Paris');
            assert.ok(airlines.some(a => ['Lufthansa', 'Air France', 'KLM', 'British Airways'].includes(a)));
        });

        it('should return appropriate airlines for different routes', () => {
            const airlines = flightService.getRealisticAirlines('New York', 'Los Angeles');
            assert.ok(airlines.length > 0);
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
            assert.ok(data.success);
            assert.ok(data.flights);
            assert.ok(Array.isArray(data.flights));
            assert.ok(data.flights.length > 0);
        });

        it('should include airport codes in route', async () => {
            const data = await flightService.getFlightInfo('London', 'Paris');
            assert.ok(data.originCode === 'LHR');
            assert.ok(data.destCode === 'CDG');
        });

        it('should generate booking sites/links', async () => {
            const data = await flightService.getFlightInfo('Tokyo', 'New York');
            assert.ok(data.success);
            assert.ok(data.flights[0].bookingUrl);
        });

        it('should cache flight data', async () => {
            // First call
            const data1 = await flightService.getFlightInfo('London', 'Paris');

            // Second call should use cache
            const data2 = await flightService.getFlightInfo('London', 'Paris');

            assert.ok(data1);
            assert.ok(data2);
            assert.strictEqual(data1.from, data2.from);
            assert.strictEqual(data1.to, data2.to);
        });

        it('should handle unknown cities gracefully', async () => {
            const data = await flightService.getFlightInfo('UnknownCity1', 'UnknownCity2');
            assert.ok(data);
            assert.ok(data.success);
            assert.ok(data.flights && data.flights.length > 0);
        });

        it('should include price information', async () => {
            const data = await flightService.getFlightInfo('London', 'Paris');
            assert.ok(data.success);
            assert.ok(data.flights[0].price);
            assert.ok(data.flights[0].price.amount);
            assert.ok(data.flights[0].price.display);
        });

        it('should include flight dates and times', async () => {
            const data = await flightService.getFlightInfo('London', 'Paris');
            assert.ok(data.flights[0].departure.date);
            assert.ok(data.flights[0].departure.timeDisplay);
            assert.ok(data.flights[0].arrival.date);
            assert.ok(data.flights[0].arrival.timeDisplay);
        });

        it('should include airline information', async () => {
            const data = await flightService.getFlightInfo('London', 'Paris');
            assert.ok(data.flights[0].airline);
            assert.ok(data.flights[0].flightNumber);
        });
    });

    describe('get Flight Tips', () => {
        it('should return array of helpful tips', () => {
            const tips = flightService.getFlightTips('London', 'Paris', {});
            assert.ok(Array.isArray(tips));
            assert.ok(tips.length > 0);
            assert.ok(tips.every(tip => typeof tip === 'string'));
        });
    });
});

