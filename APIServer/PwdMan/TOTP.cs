/*
    Myna API Server
    Copyright (C) 2020-2021 Niels Stockfleth

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
using System.Security.Cryptography;

namespace APIServer.PwdMan
{
    // rfc6238 
    // 
    // see also
    // https://github.com/BrandonPotter/GoogleAuthenticator/blob/master/Google.Authenticator/TwoFactorAuthenticator.cs
    // https://github.com/google/google-authenticator/wiki/Key-Uri-Format
    public class TOTP
    {
        public static bool IsValid(string totp, string secret, int validSeconds)
        {
            var unixSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var secretKey = Base32.FromBase32(secret);
            for (var cnt = unixSeconds - validSeconds; cnt <= unixSeconds + validSeconds; cnt += 30)
            {
                var validTOTP = Generate(cnt, secretKey);
                if (validTOTP == totp)
                {
                    return true;
                }
            }
            return false;
        }

        // --- private

        private static string Generate(long unixTimeSeconds, byte[] privateKey, int digits = 6, int validSeconds = 30)
        {
            long msgtime = unixTimeSeconds / validSeconds;
            var msg = BitConverter.GetBytes(msgtime);
            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(msg);
            }
            using var alg = new HMACSHA1(privateKey); // HMACSHA256, HMACSHA512
            var hash = alg.ComputeHash(msg);
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

        private static readonly int[] DIGITS_POWER = { 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000 };

    }
}
