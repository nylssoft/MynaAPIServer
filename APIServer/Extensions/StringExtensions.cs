/*
    Myna API Server
    Copyright (C) 2025 Niels Stockfleth

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
using System.IO.Compression;
using System.IO;
using System.Text;
using System;

namespace APIServer.Extensions
{
    public static class StringExtensions
    {
        public static string Decompress(this string base64CompressedValue)
        {
            using var source = new MemoryStream(Convert.FromBase64String(base64CompressedValue));
            using var zipstream = new GZipStream(source, CompressionMode.Decompress);
            using var dest = new MemoryStream();
            zipstream.CopyTo(dest);
            return Encoding.UTF8.GetString(dest.ToArray());
        }

        public static string Compress(this string value)
        {
            using var dest = new MemoryStream();
            using var zipstream = new GZipStream(dest, CompressionMode.Compress);
            using var source = new MemoryStream(Encoding.UTF8.GetBytes(value));
            source.CopyTo(zipstream);
            zipstream.Close();
            return Convert.ToBase64String(dest.ToArray());
        }
    }
}
