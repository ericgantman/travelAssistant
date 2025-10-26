/**
 * Hallucination Detection Tests
 * Ensures the agent doesn't invent data when tools aren't properly used
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Hallucination Detection', () => {
    describe('Flight Data Hallucination Patterns', () => {
        it('should detect hallucinated flight prices in USD', () => {
            const hallucinatedResponse = "I found flights for $230, $450, and $189.";
            const pricePattern = /\$\d{2,4}/;
            assert.strictEqual(pricePattern.test(hallucinatedResponse), true);
        });

        it('should detect hallucinated flight prices in multiple currencies', () => {
            const responses = [
                "Flights cost $450 to $600",
                "Expect to pay €320-€450",
                "Budget around £200-£350",
                "Prices range from ₪1200 to ₪1500"
            ];

            const currencyPattern = /\$\d{2,4}|\₪\d{2,4}|€\d{2,4}|£\d{2,4}/;

            responses.forEach(response => {
                assert.strictEqual(currencyPattern.test(response), true);
            });
        });

        it('should detect hallucinated specific dates', () => {
            const responses = [
                "Flight on March 15th",
                "Departure: April 3rd, 2025",
                "Travel on December 25th",
                "Book for January 1st"
            ];

            const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/;

            responses.forEach(response => {
                assert.strictEqual(datePattern.test(response), true);
            });
        });

        it('should detect hallucinated airline names', () => {
            const airlines = [
                "Turkish Airlines",
                "Lufthansa Airlines",
                "Emirates Airways",
                "United Airlines",
                "Delta Airways",
                "British Airways",
                "Air France",
                "KLM Airlines",
                "Qatar Airways",
                "El Al Airlines",
                "Ryanair Airways",
                "EasyJet Airlines"
            ];

            const airlinePattern = /(?:Turkish|Lufthansa|Austrian|Emirates|United|Delta|British\s+Airways|Air\s+France|KLM|Qatar|Etihad|Singapore|Cathay|El\s+Al|Ryanair|EasyJet|Southwest)(?:\s+(?:Airlines?|Airways))?/i;

            airlines.forEach(airline => {
                assert.strictEqual(airlinePattern.test(airline), true);
            });
        });

        it('should detect hallucinated flight numbers', () => {
            const flightNumbers = [
                "Flight LH 123",
                "TK 456",
                "BA1234",
                "UA 789",
                "LY375"
            ];

            const flightNumberPattern = /\b(?:[A-Z]{2}|[0-9A-Z]{2})\s*\d{3,4}\b/;

            flightNumbers.forEach(flightNum => {
                assert.strictEqual(flightNumberPattern.test(flightNum), true);
            });
        });

        it('should detect hallucinated price ranges', () => {
            const priceRanges = [
                "$200-$450",
                "$300 - $500",
                "₪1200-₪1500",
                "€150 - €300"
            ];

            const priceRangePattern = /\$\d+\s*-\s*\$\d+|₪\d+\s*-\s*₪\d+|€\d+\s*-\s*€\d+/;

            priceRanges.forEach(range => {
                assert.strictEqual(priceRangePattern.test(range), true);
            });
        });

        it('should detect hallucinated departure/arrival times', () => {
            const times = [
                "Departs at 10:30 AM",
                "Arrival: 3:45 PM",
                "Leaves at 08:15 am",
                "Returns 11:50pm"
            ];

            const timePattern = /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/;

            times.forEach(time => {
                assert.strictEqual(timePattern.test(time), true);
            });
        });

        it('should NOT flag general guidance as hallucination', () => {
            const validResponses = [
                "Check prices on Google Flights",
                "Flights typically cost between budget and premium depending on season",
                "Book in advance for better prices",
                "Prices vary by date and airline"
            ];

            const pricePattern = /\$\d{2,4}/;
            const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?/;

            validResponses.forEach(response => {
                assert.strictEqual(pricePattern.test(response), false);
                assert.strictEqual(datePattern.test(response), false);
            });
        });
    });

    describe('Hotel Data Hallucination Patterns', () => {
        it('should detect hallucinated hotel names', () => {
            const responses = [
                "Stay at the Grand Hyatt Paris",
                "I recommend the Marriott Downtown",
                "Book the Hilton Garden Inn"
            ];

            const hotelChainPattern = /(?:Marriott|Hilton|Hyatt|Sheraton|Holiday Inn|Best Western|Radisson|InterContinental|Four Seasons|Ritz-Carlton|Westin|Renaissance)/i;

            responses.forEach(response => {
                assert.strictEqual(hotelChainPattern.test(response), true);
            });
        });

        it('should detect hallucinated hotel prices', () => {
            const responses = [
                "Rooms start at $120 per night",
                "Expect to pay €85/night",
                "Budget hotels around £50-£80"
            ];

            const pricePattern = /\$\d{2,4}|€\d{2,4}|£\d{2,4}/;

            responses.forEach(response => {
                assert.strictEqual(pricePattern.test(response), true);
            });
        });

        it('should NOT flag general hotel advice as hallucination', () => {
            const validResponses = [
                "Check Booking.com for availability",
                "Hotels in the city center tend to be more expensive",
                "Consider budget options or hostels"
            ];

            const hotelChainPattern = /(?:Marriott|Hilton|Hyatt|Sheraton)/i;
            const specificPricePattern = /\$\d{2,4}|€\d{2,4}|£\d{2,4}/;

            validResponses.forEach(response => {
                assert.strictEqual(hotelChainPattern.test(response), false);
                assert.strictEqual(specificPricePattern.test(response), false);
            });
        });
    });

    describe('Weather Data Hallucination Patterns', () => {
        it('should detect hallucinated temperature values', () => {
            const responses = [
                "Currently 23°C in Paris",
                "Temperature is 72°F",
                "Expect around 15-18°C"
            ];

            const tempPattern = /\d{1,3}°[CF]/;

            responses.forEach(response => {
                assert.strictEqual(tempPattern.test(response), true);
            });
        });

        it('should NOT flag general weather advice as hallucination', () => {
            const validResponses = [
                "Paris can be cool in spring",
                "Bring layers for variable weather",
                "Check the forecast before packing"
            ];

            const tempPattern = /\d{1,3}°[CF]/;

            validResponses.forEach(response => {
                assert.strictEqual(tempPattern.test(response), false);
            });
        });
    });

    describe('Currency Conversion Hallucination Patterns', () => {
        it('should detect hallucinated exchange rates', () => {
            const responses = [
                "The rate is 1.25 USD to EUR",
                "1 USD = 3.7 ILS here",
                "Exchange rate: 1.18 EUR per USD"
            ];

            const ratePattern = /\d+\.?\d*\s*(?:USD|EUR|GBP|ILS|JPY|CNY)/i;

            responses.forEach(response => {
                assert.strictEqual(ratePattern.test(response), true);
            });
        });

        it('should detect hallucinated conversion amounts', () => {
            const responses = [
                "7000 shekels is about $1890",
                "That's approximately €450",
                "Roughly £320"
            ];

            const amountPattern = /\$\d{2,5}|€\d{2,5}|£\d{2,5}|₪\d{2,5}/;

            responses.forEach(response => {
                assert.strictEqual(amountPattern.test(response), true);
            });
        });
    });

    describe('Edge Cases - Valid Responses That Should NOT Trigger Detection', () => {
        it('should allow general price discussions without specific amounts', () => {
            const validResponses = [
                "Flights can range from budget to premium",
                "Prices vary by season and availability",
                "Book early for better deals",
                "Check multiple booking sites for comparison"
            ];

            const pricePattern = /\$\d{2,4}/;

            validResponses.forEach(response => {
                assert.strictEqual(pricePattern.test(response), false);
            });
        });

        it('should allow general date references without specific dates', () => {
            const validResponses = [
                "Visit in spring for mild weather",
                "Summer is peak season",
                "Book several months in advance",
                "Prices are lower in winter"
            ];

            const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?/;

            validResponses.forEach(response => {
                assert.strictEqual(datePattern.test(response), false);
            });
        });

        it('should allow booking site URLs and references', () => {
            const validResponses = [
                "Check Skyscanner.com",
                "Use Google Flights to compare",
                "Try Booking.com or Expedia",
                "Visit Kayak for price alerts"
            ];

            const invalidPattern = /\$\d{2,4}/;

            validResponses.forEach(response => {
                assert.strictEqual(invalidPattern.test(response), false);
            });
        });
    });

    describe('Comprehensive Hallucination Detection Suite', () => {
        const detectHallucination = (responseText) => {
            const patterns = {
                prices: /\$\d{2,4}|\₪\d{2,4}|€\d{2,4}|£\d{2,4}/,
                dates: /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/,
                airlines: /(?:Turkish|Lufthansa|Austrian|Emirates|United|Delta|British Airways|Air France|KLM|Qatar|Etihad|Singapore|Cathay|El Al|Ryanair|EasyJet|Southwest)\s+(?:Airlines?|Airways)?/i,
                flightNumbers: /\b(?:[A-Z]{2}|[0-9A-Z]{2})\s*\d{3,4}\b/,
                priceRanges: /\$\d+\s*-\s*\$\d+|₪\d+\s*-\s*₪\d+|€\d+\s*-\s*€\d+/,
                times: /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/,
                temperatures: /\d{1,3}°[CF]/,
                hotelChains: /(?:Marriott|Hilton|Hyatt|Sheraton|Holiday Inn|Best Western|Radisson|InterContinental|Four Seasons|Ritz-Carlton)/i
            };

            const detected = {};
            for (const [key, pattern] of Object.entries(patterns)) {
                detected[key] = pattern.test(responseText);
            }

            return detected;
        };

        it('should detect multiple hallucination types in a single response', () => {
            const hallucinatedResponse = `
                I found flights from Tel Aviv to Lisbon:
                - Turkish Airlines TK 1234 departs March 15th at 10:30 AM for $450
                - Lufthansa LH 5678 leaves April 3rd at 2:15 PM for €420
                Current weather in Lisbon is 22°C.
                Stay at the Marriott Downtown for $180/night.
            `;

            const detected = detectHallucination(hallucinatedResponse);

            assert.strictEqual(detected.prices, true);
            assert.strictEqual(detected.dates, true);
            assert.strictEqual(detected.airlines, true);
            assert.strictEqual(detected.flightNumbers, true);
            assert.strictEqual(detected.times, true);
            assert.strictEqual(detected.temperatures, true);
            assert.strictEqual(detected.hotelChains, true);
        });

        it('should NOT detect hallucination in valid, tool-based response', () => {
            const validResponse = `
                I've found flight options from Tel Aviv to Lisbon.
                For current prices and availability, check:
                - Google Flights: https://www.google.com/flights
                - Skyscanner: https://www.skyscanner.com
                
                Tips for booking:
                - Book 2-3 months in advance for better prices
                - Consider flying on weekdays for lower fares
                - Compare multiple booking sites
                
                For hotels in Lisbon, check Booking.com or Airbnb for the best deals.
                The Alfama and Baixa neighborhoods are popular with tourists.
            `;

            const detected = detectHallucination(validResponse);

            assert.strictEqual(detected.prices, false);
            assert.strictEqual(detected.dates, false);
            assert.strictEqual(detected.airlines, false);
            assert.strictEqual(detected.flightNumbers, false);
            assert.strictEqual(detected.times, false);
            assert.strictEqual(detected.hotelChains, false);
        });

        it('should handle edge case of URLs containing numbers', () => {
            const responseWithUrls = `
                Check prices at:
                - Skyscanner.com
                - Google.com/flights
                - Booking.com
                Prices update every 24 hours.
            `;

            const detected = detectHallucination(responseWithUrls);

            // "24 hours" should not trigger price detection
            assert.strictEqual(detected.prices, false);
            assert.strictEqual(detected.times, false);
        });
    });
});
