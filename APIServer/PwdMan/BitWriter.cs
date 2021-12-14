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
using System.IO;

namespace APIServer.PwdMan
{
    public class BitWriter
    {
        private readonly Stream stream;
        private int bitPos;
        private byte writeByte;

        public BitWriter(Stream dataStream)
        {
            stream = dataStream;
            bitPos = 7;
            writeByte = 0;
        }

        public void WriteBit(int bit)
        {
            if (bit == 1)
            {
                writeByte |= (byte)(1 << bitPos);
            }
            bitPos--;
            if (bitPos < 0)
            {
                stream.WriteByte(writeByte);
                writeByte = 0;
                bitPos = 7;
            }
        }

        public void WriteBits(int value, int cnt)
        {
            while (cnt > 0)
            {
                var mask = 1 << (cnt - 1);
                WriteBit((value & mask) == mask ? 1 : 0);
                cnt--;
            }
        }
    }
}
