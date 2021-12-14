/*
    Myna API Server
    Copyright (C) 2021 Niels Stockfleth

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
using System.IO;
using System.Text;

namespace APIServer.PwdMan
{
    // Provides Base32 encoding, see rfc3548
    public static class ConvertExtension
    {
        private const string BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        public static byte[] FromBase32String(string str)
        {
            using MemoryStream mem = new();
            var bitWriter = new BitWriter(mem);
            foreach (var c in str)
            {
                var val = 0;
                if (c >= 'A' && c <= 'Z')
                {
                    val = c - 'A';
                }
                else if (c >= '2' && c <= '7')
                {
                    val = c - '2' + 26;
                }
                else if (c == '=')
                {
                    break;
                }
                else
                {
                    throw new ArgumentException($"Invalid character '{c}'.");
                }
                bitWriter.WriteBits(val, 5);
            }
            return mem.ToArray();
        }

        public static string ToBase32String(byte [] data)
        {
            using MemoryStream mem = new(data);
            var bitReader = new BitReader(mem);
            var sb = new StringBuilder();
            while (true)
            {
                var val = bitReader.NextBits(5);
                if (val < 0)
                {
                    break;
                }
                sb.Append(BASE32_CHARS[val]);
            }
            // mapping groups from 5 bytes (40 bits) to 8 characters (8 * 5 bits = 40 bits)
            // add padding bytes if required to fill up to 16 characters (16 * 5 bits = 80 bits)
            var r = data.Length % 5;
            if (r > 0)
            {
                // r * 8 extra bits needs ((r * 8) / 5) + 1 chars
                // fill up until 8 chars are reached
                int padding = 8 - (((r * 8) / 5) + 1);
                sb.Append(new string('=', padding));
            }
            return sb.ToString();
        }
    }
}
