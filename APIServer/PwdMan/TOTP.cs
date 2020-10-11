/*
    Myna API Server
    Copyright (C) 2020 Niels Stockfleth

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
using System;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;

namespace APIServer.PwdMan
{
    // rfc6238 
    public class TOTP
    {
        public static string Generate(string totpKey, int digits, int validSeconds)
        {
            var privateKey = Encoding.UTF8.GetBytes(totpKey);
            long unixtime = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / validSeconds;
            byte[] msg = new BigInteger(unixtime).ToByteArray(isBigEndian: true);
            byte[] hash = GetHMACSHA256(privateKey, msg);
            int offset = hash[^1] & 0xf;
            int binary =
                ((hash[offset] & 0x7f) << 24) |
                ((hash[offset + 1] & 0xff) << 16) |
                ((hash[offset + 2] & 0xff) << 8) |
                (hash[offset + 3] & 0xff);
            int otp = binary % DIGITS_POWER[digits];
            var result = Convert.ToString(otp);
            while (result.Length < digits)
            {
                result = "0" + result;
            }
            return result;
        }

        // --- private

        private static byte[] GetHMACSHA256(byte[] keyBytes, byte[] textBytes)
        {
            using (var hash = new HMACSHA256(keyBytes))
            {
                return hash.ComputeHash(textBytes);
            }
        }

        private static readonly int[] DIGITS_POWER = { 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000 };

    }
}
